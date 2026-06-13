import { corsHeaders, fail, ok } from '../_shared/response.ts';
import { sendTwilioWhatsApp, twilioWhatsAppHint } from '../_shared/twilioWhatsApp.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';

interface TestPayload {
  bodyshopId: string;
  phone?: string;
  messageTemplate?: string;
  appPublicUrl?: string;
}

const DEFAULT_TEMPLATE = `Dent Vision — new lead in {{region}}
{{damage}} · {{estimate}}
Respond within 3 min: {{link}}`;

const applyTemplate = (template: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce(
    (text, [key, value]) => text.replaceAll(`{{${key}}}`, value),
    template,
  );

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

    const [shopRes, settingsRes] = await Promise.all([
      supabase.from('bodyshops').select('business_name, region, phone').eq('id', payload.bodyshopId).maybeSingle(),
      supabase.from('notification_settings').select('*').eq('bodyshop_id', payload.bodyshopId).maybeSingle(),
    ]);

    const shop = shopRes.data;
    const settings = settingsRes.data;
    const targetPhone =
      payload.phone?.trim() ||
      settings?.whatsapp_phone ||
      owner?.phone ||
      shop?.phone;

    if (!targetPhone) {
      return fail('No WhatsApp number configured. Add one under Notification Preferences and save.');
    }

    const appBase = (payload.appPublicUrl || Deno.env.get('APP_PUBLIC_URL') || '').replace(/\/$/, '');
    const sampleLink = appBase ? `${appBase}/#/partner/leads` : '#/partner/leads';
    const template = payload.messageTemplate?.trim() || settings?.whatsapp_message_template || DEFAULT_TEMPLATE;
    const messageBody = applyTemplate(template, {
      region: String(shop?.region || 'Sunshine Coast, QLD'),
      damage: 'Test dent · Front door',
      estimate: '$280–$420',
      link: sampleLink,
      customer: 'Test Customer',
      location: 'Front door',
    });

    const testPrefix = 'Dent Vision — WhatsApp test\n';
    const wa = await sendTwilioWhatsApp(String(targetPhone), `${testPrefix}${messageBody}`);

    await supabase.from('notification_logs').insert({
      bodyshop_id: payload.bodyshopId,
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
      });
    }

    return ok({
      sent: true,
      sid: wa.sid,
      phone: targetPhone,
      message: 'Test WhatsApp sent. Check your phone in a few seconds.',
    });
  } catch (error) {
    console.error('[test-partner-whatsapp]', error);
    return fail(error instanceof Error ? error.message : 'Unexpected error', 'INTERNAL_ERROR', 500);
  }
});
