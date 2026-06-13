import { corsHeaders, fail, ok } from '../_shared/response.ts';
import { sendTwilioWhatsApp } from '../_shared/twilioWhatsApp.ts';
import { pickLeadPhotoUrl } from '../_shared/leadPhotos.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import webpush from 'https://esm.sh/web-push@3.6.7';

interface NotifyPayload {
  matchId: string;
  leadId: string;
  bodyshopId: string;
  appPublicUrl?: string;
}

const DEFAULT_TEMPLATE = `Dent Vision — new lead in {{region}}
{{damage}} · {{estimate}}
View dent & respond: {{link}}`;

const formatMoney = (value: number) => `$${Math.round(value).toLocaleString('en-AU')}`;

const formatEstimate = (min?: number | null, max?: number | null) => {
  const lo = Number(min || 0);
  const hi = Number(max || lo);
  if (!lo && !hi) return 'Estimate pending';
  if (lo === hi) return formatMoney(lo);
  return `${formatMoney(lo)}–${formatMoney(hi)}`;
};

const applyTemplate = (
  template: string,
  vars: Record<string, string>,
) =>
  Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );

const sendResendEmail = async (to: string, subject: string, html: string) => {
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const fromEmail = Deno.env.get('RESEND_FROM_EMAIL') || 'Dent Vision <onboarding@resend.dev>';

  if (!resendKey) {
    return { sent: false, skipped: true, reason: 'Resend not configured' };
  }

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from: fromEmail, to: [to], subject, html }),
  });

  const result = await response.json();
  if (!response.ok) {
    return { sent: false, reason: result?.message || 'Resend failed' };
  }

  return { sent: true, id: result.id };
};

const sendWebPushBatch = async (
  subscriptions: Array<{ endpoint: string; p256dh: string; auth: string }>,
  payload: { title: string; body: string; url: string },
) => {
  const publicKey = Deno.env.get('VAPID_PUBLIC_KEY');
  const privateKey = Deno.env.get('VAPID_PRIVATE_KEY');
  const subject = Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@dentvision.app';

  if (!publicKey || !privateKey || !subscriptions.length) {
    return { sent: 0, skipped: true };
  }

  webpush.setVapidDetails(subject, publicKey, privateKey);

  let sent = 0;
  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload),
      );
      sent += 1;
    } catch (error) {
      console.warn('[notify-partner-new-lead] push failed', sub.endpoint, error);
    }
  }

  return { sent };
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return fail('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const payload = (await req.json()) as NotifyPayload;
    if (!payload.matchId || !payload.leadId || !payload.bodyshopId) {
      return fail('Missing matchId, leadId, or bodyshopId');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !serviceKey) {
      return fail('Server misconfigured', 'CONFIG_ERROR', 500);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: token, error: tokenError } = await supabase.rpc('provision_partner_lead_token', {
      p_match_id: payload.matchId,
    });
    if (tokenError || !token) {
      return fail(tokenError?.message || 'Could not create respond token');
    }

    const appBase = (payload.appPublicUrl || Deno.env.get('APP_PUBLIC_URL') || '').replace(/\/$/, '');
    const respondUrl = appBase
      ? `${appBase}/#/p/lead?token=${encodeURIComponent(String(token))}`
      : `#/p/lead?token=${encodeURIComponent(String(token))}`;

    const [leadRes, shopRes, settingsRes, ownerRes, pushRes] = await Promise.all([
      supabase.from('lead_requests').select('*').eq('id', payload.leadId).maybeSingle(),
      supabase.from('bodyshops').select('*').eq('id', payload.bodyshopId).maybeSingle(),
      supabase.from('notification_settings').select('*').eq('bodyshop_id', payload.bodyshopId).maybeSingle(),
      supabase
        .from('bodyshop_owners')
        .select('email, phone, name')
        .eq('bodyshop_id', payload.bodyshopId)
        .eq('active_status', true)
        .limit(1)
        .maybeSingle(),
      supabase.rpc('get_partner_push_subscriptions', { p_bodyshop_id: payload.bodyshopId }),
    ]);

    const lead = leadRes.data;
    const shop = shopRes.data;
    const settings = settingsRes.data;
    const owner = ownerRes.data;
    const pushSubs = (pushRes.data || []) as Array<{ endpoint: string; p256dh: string; auth: string }>;

    const region = shop?.region || lead?.region || 'your area';
    const damage = [lead?.ai_damage_category, lead?.damage_location].filter(Boolean).join(' · ') || 'Dent repair';
    const estimate = formatEstimate(
      lead?.ai_pdr_estimate_min ?? lead?.ai_estimate_min,
      lead?.ai_pdr_estimate_max ?? lead?.ai_estimate_max,
    );

    const template = settings?.whatsapp_message_template || DEFAULT_TEMPLATE;
    const messageBody = applyTemplate(template, {
      region: String(region),
      damage: String(damage),
      estimate,
      link: respondUrl,
      customer: String(lead?.customer_name || 'Customer'),
      location: String(lead?.damage_location || 'Vehicle panel'),
    });

    const whatsappPhone =
      settings?.whatsapp_phone || owner?.phone || shop?.phone || null;
    const ownerEmail = owner?.email || shop?.email || null;

    let whatsappSent = false;
    let whatsappSkipped = false;
    let whatsappReason: string | undefined;

    if (settings?.whatsapp_enabled !== false && whatsappPhone) {
      const photoUrl = pickLeadPhotoUrl(lead);
      const wa = await sendTwilioWhatsApp(String(whatsappPhone), messageBody, {
        mediaUrl: photoUrl,
      });
      whatsappSent = !!wa.sent;
      whatsappSkipped = !!wa.skipped;
      whatsappReason = wa.reason;
    } else {
      whatsappSkipped = true;
      whatsappReason = 'WhatsApp disabled or no phone configured';
    }

    let pushSent = 0;
    if (settings?.push_enabled !== false && pushSubs.length) {
      const pushResult = await sendWebPushBatch(pushSubs, {
        title: `New lead — ${region}`,
        body: `${damage} · ${estimate}`,
        url: respondUrl,
      });
      pushSent = pushResult.sent || 0;
    }

    let emailSent = false;
    let emailSkipped = false;
    if (!whatsappSent && settings?.email_enabled !== false && ownerEmail) {
      const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;line-height:1.5;color:#111827;max-width:560px;margin:0 auto;padding:24px;">
        <h2 style="color:#4f46e5;">New lead for ${shop?.business_name || 'your shop'}</h2>
        <p><strong>${lead?.customer_name || 'Customer'}</strong> submitted a dent estimate in <strong>${region}</strong>.</p>
        <p>${damage}<br/>AI estimate: <strong>${estimate}</strong></p>
        <p style="margin:28px 0;"><a href="${respondUrl}" style="background:#4f46e5;color:#fff;text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:700;display:inline-block;">Respond to lead</a></p>
        <p style="font-size:13px;color:#64748b;">WhatsApp alert could not be delivered — this email is your backup channel.</p>
      </body></html>`;

      const email = await sendResendEmail(
        String(ownerEmail),
        `New lead — ${region}`,
        html,
      );
      emailSent = !!email.sent;
      emailSkipped = !!email.skipped;
    }

    await supabase.from('notification_logs').insert({
      bodyshop_id: payload.bodyshopId,
      lead_id: payload.leadId,
      channel: whatsappSent ? 'whatsapp' : emailSent ? 'email' : pushSent ? 'push' : 'none',
      status: whatsappSent || emailSent || pushSent ? 'sent' : 'skipped',
      message: messageBody.slice(0, 500),
      failed_reason: whatsappSent ? null : whatsappReason,
    });

    const devMode = whatsappSkipped && emailSkipped && !pushSent;

    return ok({
      whatsappSent,
      pushSent,
      emailSent,
      respondUrl,
      devMode,
      message: devMode
        ? 'Notification providers not fully configured — use respond URL manually in dev.'
        : undefined,
    });
  } catch (error) {
    console.error('[notify-partner-new-lead]', error);
    return fail(error instanceof Error ? error.message : 'Unexpected error', 'INTERNAL_ERROR', 500);
  }
});
