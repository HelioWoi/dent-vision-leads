import { corsHeaders, fail, ok } from '../_shared/response.ts';
import { sendTwilioWhatsApp, twilioWhatsAppHint } from '../_shared/twilioWhatsApp.ts';
import { pickLeadPhotoUrl } from '../_shared/leadPhotos.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

interface TestPayload {
  bodyshopId: string;
  phone?: string;
  messageTemplate?: string;
  appPublicUrl?: string;
}

const DEFAULT_TEMPLATE = `Dent Vision — new lead in {{region}}
{{damage}} · {{estimate}}
View dent & respond: {{link}}`;

const applyTemplate = (template: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );

const formatEstimate = (min?: number | null, max?: number | null) => {
  const lo = Number(min || 0);
  const hi = Number(max || lo);
  if (!lo && !hi) return '$280–$420';
  if (lo === hi) return `$${Math.round(lo).toLocaleString('en-AU')}`;
  return `$${Math.round(lo).toLocaleString('en-AU')}–$${Math.round(hi).toLocaleString('en-AU')}`;
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return fail('Method not allowed', 'METHOD_NOT_ALLOWED', 405);
  }

  try {
    const payload = (await req.json()) as TestPayload;
    if (!payload.bodyshopId) {
      return fail('Missing bodyshopId');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
    if (!supabaseUrl || !serviceKey || !anonKey) {
      return fail('Server misconfigured', 'CONFIG_ERROR', 500);
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return fail('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser();
    const user = userData?.user;
    if (userError || !user?.email) {
      return fail('Unauthorized', 'UNAUTHORIZED', 401);
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    const { data: owner } = await supabase
      .from('bodyshop_owners')
      .select('id, email, phone')
      .eq('bodyshop_id', payload.bodyshopId)
      .eq('active_status', true)
      .ilike('email', user.email)
      .maybeSingle();

    if (!owner) {
      const { data: partnerShopIds } = await userClient.rpc('partner_bodyshop_ids');
      const allowed = Array.isArray(partnerShopIds)
        ? partnerShopIds.map(String).includes(String(payload.bodyshopId))
        : false;
      if (!allowed) {
        return fail('You do not have access to this shop', 'FORBIDDEN', 403);
      }
    }

    const [shopRes, settingsRes, latestMatchRes] = await Promise.all([
      supabase.from('bodyshops').select('business_name, region, phone').eq('id', payload.bodyshopId).maybeSingle(),
      supabase.from('notification_settings').select('*').eq('bodyshop_id', payload.bodyshopId).maybeSingle(),
      supabase
        .from('shop_lead_matches')
        .select('id, lead_id')
        .eq('bodyshop_id', payload.bodyshopId)
        .eq('status', 'new')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const shop = shopRes.data;
    const settings = settingsRes.data;
    const latestMatch = latestMatchRes.data;
    const targetPhone =
      payload.phone?.trim() ||
      settings?.whatsapp_phone ||
      owner?.phone ||
      shop?.phone;

    if (!targetPhone) {
      return fail('No WhatsApp number configured. Add one under Notification Preferences and save.');
    }

    const appBase = (payload.appPublicUrl || Deno.env.get('APP_PUBLIC_URL') || '').replace(/\/$/, '');

    let lead: Record<string, unknown> | null = null;
    let respondUrl = appBase ? `${appBase}/#/partner/leads` : '#/partner/leads';
    let photoUrl: string | undefined;

    if (latestMatch?.id) {
      const { data: token } = await supabase.rpc('provision_partner_lead_token', {
        p_match_id: latestMatch.id,
      });

      if (token) {
        respondUrl = appBase
          ? `${appBase}/#/p/lead?token=${encodeURIComponent(String(token))}`
          : `#/p/lead?token=${encodeURIComponent(String(token))}`;
      }

      if (latestMatch.lead_id) {
        const { data: leadRow } = await supabase
          .from('lead_requests')
          .select('*')
          .eq('id', latestMatch.lead_id)
          .maybeSingle();
        lead = leadRow;
        photoUrl = pickLeadPhotoUrl(leadRow);
      }
    }

    const region = String(shop?.region || lead?.region || 'Sunshine Coast, QLD');
    const damage = lead
      ? [lead.ai_damage_category, lead.damage_location].filter(Boolean).join(' · ') || 'Dent repair'
      : 'Test dent · Front door';
    const estimate = lead
      ? formatEstimate(
        lead.ai_pdr_estimate_min as number | null,
        lead.ai_pdr_estimate_max as number | null,
      )
      : '$280–$420';

    const template = payload.messageTemplate?.trim() || settings?.whatsapp_message_template || DEFAULT_TEMPLATE;
    const messageBody = applyTemplate(template, {
      region,
      damage: String(damage),
      estimate,
      link: respondUrl,
      customer: String(lead?.customer_name || 'Test Customer'),
      location: String(lead?.damage_location || 'Front door'),
    });

    const testPrefix = 'Dent Vision — WhatsApp test\n';
    const wa = await sendTwilioWhatsApp(String(targetPhone), `${testPrefix}${messageBody}`, {
      mediaUrl: photoUrl,
    });

    await supabase.from('notification_logs').insert({
      bodyshop_id: payload.bodyshopId,
      lead_id: latestMatch?.lead_id || null,
      channel: 'whatsapp',
      status: wa.sent ? 'sent' : 'failed',
      message: `${testPrefix}${messageBody}`.slice(0, 500),
      failed_reason: wa.sent ? null : wa.reason,
    });

    if (!wa.sent) {
      return ok({
        sent: false,
        reason: wa.reason || 'WhatsApp test failed',
        code: wa.code,
        hint: twilioWhatsAppHint(wa.code, wa.reason),
        phone: targetPhone,
        respondUrl,
        photoAttached: !!photoUrl,
      });
    }

    return ok({
      sent: true,
      sid: wa.sid,
      phone: targetPhone,
      respondUrl,
      photoAttached: !!photoUrl,
      message: photoUrl
        ? 'Test WhatsApp sent with car photo. Open the link to view the dent and respond.'
        : 'Test WhatsApp sent. Open the link to view the lead (no photo on latest lead).',
    });
  } catch (error) {
    console.error('[test-partner-whatsapp]', error);
    return fail(error instanceof Error ? error.message : 'Unexpected error', 'INTERNAL_ERROR', 500);
  }
});
