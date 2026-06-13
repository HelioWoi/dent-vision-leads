import { supabase } from './supabaseClient';

export const DEFAULT_WHATSAPP_MESSAGE_TEMPLATE = `Dent Vision — new lead in {{region}}
{{damage}} · {{estimate}}
View dent & respond: {{link}}`;

export interface NotifyPartnerLeadInput {
  matchId: string;
  leadId: string;
  bodyshopId: string;
}

export interface NotifyPartnerLeadResult {
  ok: boolean;
  whatsappSent?: boolean;
  pushSent?: number;
  emailSent?: boolean;
  respondUrl?: string;
  devMode?: boolean;
  error?: string;
}

export interface TestWhatsAppResult {
  ok: boolean;
  sent?: boolean;
  message?: string;
  hint?: string;
  reason?: string;
  phone?: string;
  error?: string;
}

const edgeBaseUrl = () => {
  const envBag = (import.meta as any).env || {};
  return envBag.VITE_SUPABASE_URL
    ? `${envBag.VITE_SUPABASE_URL}/functions/v1`
    : 'http://127.0.0.1:54321/functions/v1';
};

export const buildPartnerLeadRespondUrl = (token: string) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  return `${origin}/#/p/lead?token=${encodeURIComponent(token)}`;
};

export const notifyPartnerNewLead = async (
  input: NotifyPartnerLeadInput,
): Promise<NotifyPartnerLeadResult> => {
  try {
    const envBag = (import.meta as any).env || {};
    const anonKey = envBag.VITE_SUPABASE_ANON_KEY;
    const appPublicUrl =
      envBag.VITE_APP_PUBLIC_URL || (typeof window !== 'undefined' ? window.location.origin : '');

    const response = await fetch(`${edgeBaseUrl()}/notify-partner-new-lead`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(anonKey ? { Authorization: `Bearer ${anonKey}`, apikey: anonKey } : {}),
      },
      body: JSON.stringify({
        ...input,
        appPublicUrl,
      }),
    });

    const json = await response.json();
    if (!response.ok || !json?.success) {
      return {
        ok: false,
        error: json?.error || 'Notification dispatch failed.',
      };
    }

    return {
      ok: true,
      whatsappSent: !!json.data?.whatsappSent,
      pushSent: Number(json.data?.pushSent || 0),
      emailSent: !!json.data?.emailSent,
      respondUrl: json.data?.respondUrl,
      devMode: !!json.data?.devMode,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Notification dispatch failed.',
    };
  }
};

export const provisionPartnerLeadToken = async (matchId: string): Promise<string | null> => {
  const { data, error } = await supabase.rpc('provision_partner_lead_token' as any, {
    p_match_id: matchId,
  });
  if (error || !data) return null;
  return String(data);
};

const edgeAuthHeaders = async () => {
  const envBag = (import.meta as any).env || {};
  const anonKey = envBag.VITE_SUPABASE_ANON_KEY as string | undefined;
  const { data: { session } } = await supabase.auth.getSession();
  const token = session?.access_token || anonKey;
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}`, apikey: anonKey || token } : {}),
  };
};

export const testPartnerWhatsApp = async (input: {
  bodyshopId: string;
  phone?: string;
  messageTemplate?: string;
}): Promise<TestWhatsAppResult> => {
  try {
    const envBag = (import.meta as any).env || {};
    const appPublicUrl =
      envBag.VITE_APP_PUBLIC_URL || (typeof window !== 'undefined' ? window.location.origin : '');

    const response = await fetch(`${edgeBaseUrl()}/test-partner-whatsapp`, {
      method: 'POST',
      headers: await edgeAuthHeaders(),
      body: JSON.stringify({
        ...input,
        appPublicUrl,
      }),
    });

    const json = await response.json();
    if (!response.ok || !json?.success) {
      return {
        ok: false,
        error: json?.error || json?.data?.reason || 'WhatsApp test failed.',
        hint: json?.data?.hint,
        reason: json?.data?.reason,
      };
    }

    const data = json.data || {};
    return {
      ok: true,
      sent: !!data.sent,
      message: data.message,
      hint: data.hint,
      reason: data.reason,
      phone: data.phone,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'WhatsApp test failed.',
    };
  }
};
