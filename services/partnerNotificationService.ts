import { supabase } from './supabaseClient';
import { resolveSupabaseUrl } from './supabaseClient';

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

const edgeBaseUrl = () => `${resolveSupabaseUrl()}/functions/v1`;

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

export const testPartnerWhatsApp = async (input: {
  bodyshopId: string;
  phone?: string;
  messageTemplate?: string;
}): Promise<TestWhatsAppResult> => {
  try {
    const envBag = (import.meta as any).env || {};
    const appPublicUrl =
      envBag.VITE_APP_PUBLIC_URL || (typeof window !== 'undefined' ? window.location.origin : '');

    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      return {
        ok: false,
        error: 'Session expired. Log in again at Partner → Login, then retry Test WhatsApp.',
      };
    }

    const { data, error } = await supabase.functions.invoke('test-partner-whatsapp', {
      body: {
        ...input,
        appPublicUrl,
      },
    });

    if (error) {
      return {
        ok: false,
        error: error.message || 'WhatsApp test failed.',
      };
    }

    const payload = (data || {}) as {
      success?: boolean;
      error?: string;
      data?: {
        sent?: boolean;
        message?: string;
        hint?: string;
        reason?: string;
        phone?: string;
      };
    };

    if (payload.success === false) {
      return {
        ok: false,
        error: payload.error || payload.data?.reason || 'WhatsApp test failed.',
        hint: payload.data?.hint,
        reason: payload.data?.reason,
      };
    }

    const result = payload.data || {};
    if (!result.sent) {
      return {
        ok: true,
        sent: false,
        reason: result.reason,
        hint: result.hint,
        phone: result.phone,
        error: result.reason || 'WhatsApp test could not be delivered.',
      };
    }

    return {
      ok: true,
      sent: true,
      message: result.message,
      phone: result.phone,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'WhatsApp test failed.',
    };
  }
};
