import { supabase } from './supabaseClient';

export interface PartnerQuickLeadContext {
  valid: boolean;
  expired?: boolean;
  token?: string;
  canRespond?: boolean;
  alreadyResponded?: boolean;
  matchStatus?: string;
  responseDeadline?: string;
  bodyshopName?: string;
  bodyshopRegion?: string;
  existingQuote?: {
    quote_min?: number;
    quote_max?: number;
    quote_pdr?: number;
    quote_paint?: number;
    shop_note?: string;
  };
  lead?: {
    id: string;
    customer_name?: string;
    postal_code?: string;
    damage_category?: string;
    damage_location?: string;
    dent_count?: number;
    ai_estimate_min?: number;
    ai_estimate_max?: number;
    ai_pdr_estimate_min?: number;
    ai_pdr_estimate_max?: number;
    paint_repair_needed?: boolean;
    customer_comment?: string;
    photo_urls?: string[] | null;
    photo_url?: string | null;
  };
}

export type PartnerQuickRespondAction = 'accept_ai' | 'quote' | 'decline' | 'inspection';

export const getPartnerLeadByToken = async (token: string): Promise<PartnerQuickLeadContext> => {
  if (!token) return { valid: false };

  const { data, error } = await supabase.rpc('get_partner_lead_by_token' as any, {
    p_token: token,
  });

  if (error || !data) return { valid: false };

  const row = data as Record<string, unknown>;
  return {
    valid: !!row.valid,
    expired: !!row.expired,
    token: row.token ? String(row.token) : token,
    canRespond: row.can_respond !== undefined
      ? !!row.can_respond
      : !['declined', 'booked', 'completed'].includes(String(row.match_status || '')),
    alreadyResponded: !!row.already_responded,
    matchStatus: row.match_status ? String(row.match_status) : undefined,
    responseDeadline: row.response_deadline ? String(row.response_deadline) : undefined,
    bodyshopName: row.bodyshop_name ? String(row.bodyshop_name) : undefined,
    bodyshopRegion: row.bodyshop_region ? String(row.bodyshop_region) : undefined,
    existingQuote: row.existing_quote as PartnerQuickLeadContext['existingQuote'],
    lead: row.lead as PartnerQuickLeadContext['lead'],
  };
};

export const respondPartnerLeadByToken = async (
  token: string,
  action: PartnerQuickRespondAction,
  options?: { quoteMin?: number; quoteMax?: number; quotePdr?: number; quotePaint?: number; note?: string },
): Promise<{ ok: boolean; status?: string; error?: string }> => {
  const { data, error } = await supabase.rpc('respond_partner_lead_by_token' as any, {
    p_token: token,
    p_action: action,
    p_quote_min: options?.quoteMin ?? null,
    p_quote_max: options?.quoteMax ?? null,
    p_quote_pdr: options?.quotePdr ?? null,
    p_quote_paint: options?.quotePaint ?? null,
    p_note: options?.note ?? null,
  });

  if (error) {
    return { ok: false, error: error.message };
  }

  const row = (data || {}) as Record<string, unknown>;
  return { ok: !!row.ok, status: row.status ? String(row.status) : undefined };
};

export const resolveLeadPhotoUrls = (lead?: PartnerQuickLeadContext['lead']): string[] => {
  if (!lead) return [];
  const urls = Array.isArray(lead.photo_urls) ? lead.photo_urls.filter(Boolean) : [];
  if (urls.length) return urls.map(String);
  if (lead.photo_url) return [String(lead.photo_url)];
  return [];
};

export const formatEstimateRange = (min?: number, max?: number) => {
  const lo = Number(min || 0);
  const hi = Number(max || lo);
  if (!lo && !hi) return 'Estimate pending';
  if (lo === hi) return `$${lo.toLocaleString()}`;
  return `$${lo.toLocaleString()}–$${hi.toLocaleString()}`;
};
