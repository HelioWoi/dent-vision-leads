import { supabase } from './supabaseClient';
import { uploadLeadPhotos } from './leadPhotoService';
import { notifyPartnerNewLead } from './partnerNotificationService';
import { LEAD_RESPONSE_SLA_SECONDS } from './leadSla';

/** Demo shop seeded in migration — fallback when RLS/network blocks listing. */
export const DEMO_BODYSHOP_ID = '550e8400-e29b-41d4-a716-446655440001';
export const DEMO_BODYSHOP_NAME = 'Sunshine Coast PDR Co.';

export interface DispatchLeadInput {
  customerName?: string;
  customerEmail?: string;
  customerComment?: string;
  zip?: string;
  damageCategory?: string;
  location?: string;
  dentCount?: number;
  estimateMin?: number;
  estimateMax?: number;
  pdrEstimateMin?: number;
  pdrEstimateMax?: number;
  paintRepairNeeded?: boolean;
  photoCount?: number;
  photoFiles?: File[];
}

export interface DispatchLeadResult {
  ok: boolean;
  leadId?: string;
  bodyshopId?: string;
  matchedShops?: number;
  error?: string;
}

export interface BodyshopSummary {
  id: string;
  business_name: string;
  region?: string;
}

const RESPONSE_DEADLINE_SECONDS = LEAD_RESPONSE_SLA_SECONDS;

const fallbackShop = (): BodyshopSummary[] => [{
  id: DEMO_BODYSHOP_ID,
  business_name: DEMO_BODYSHOP_NAME,
  region: 'Sunshine Coast, QLD',
}];

export const fetchActiveBodyshops = async (): Promise<BodyshopSummary[]> => {
  const { data, error } = await supabase
    .from('bodyshops' as any)
    .select('id,business_name,region,active_status,notification_enabled')
    .eq('active_status', true)
    .limit(20);

  if (error) {
    console.warn('[lead-dispatch] fetchActiveBodyshops error, using demo shop', error.message);
    return fallbackShop();
  }

  const active = (data || []).filter((shop: any) => shop.notification_enabled !== false);
  return active.length ? active : fallbackShop();
};

export const dispatchLeadToBodyshops = async (
  input: DispatchLeadInput,
): Promise<DispatchLeadResult> => {
  try {
    const shops = await fetchActiveBodyshops();
    if (!shops.length) {
      return { ok: false, error: 'No active bodyshops available for lead routing.' };
    }

    const uploadedPhotos = input.photoFiles?.length
      ? await uploadLeadPhotos(input.photoFiles)
      : [];

    const leadPayload = {
      p_customer_name: input.customerName || 'Customer',
      p_customer_email: input.customerEmail || null,
      p_postal_code: input.zip || null,
      p_region: shops[0]?.region || 'Sunshine Coast, QLD',
      p_ai_damage_category: input.damageCategory || 'Dent Repair',
      p_damage_location: input.location || 'Vehicle panel',
      p_dent_count: Math.max(1, Number(input.dentCount || 1)),
      p_ai_estimate_min: Number(input.pdrEstimateMin ?? input.estimateMin ?? 0),
      p_ai_estimate_max: Number(input.pdrEstimateMax ?? input.estimateMax ?? 0),
      p_ai_pdr_estimate_min: Number(input.pdrEstimateMin ?? input.estimateMin ?? 0),
      p_ai_pdr_estimate_max: Number(input.pdrEstimateMax ?? input.estimateMax ?? 0),
      p_paint_repair_needed: !!input.paintRepairNeeded,
      p_customer_comment: input.customerComment || null,
      p_photo_urls: uploadedPhotos.length
        ? uploadedPhotos
        : input.photoCount
          ? Array.from({ length: Math.min(input.photoCount, 4) }, (_, i) => `customer-photo-${i + 1}`)
          : null,
    };

    const { data: leadId, error: leadError } = await supabase.rpc(
      'create_public_lead' as any,
      leadPayload,
    );

    if (leadError || !leadId) {
      console.error('[lead-dispatch] lead insert failed', leadError?.message);
      return { ok: false, error: leadError?.message || 'Could not create lead.' };
    }

    const leadIdStr = String(leadId);
    const deadline = new Date(Date.now() + RESPONSE_DEADLINE_SECONDS * 1000).toISOString();

    let matchedShops = 0;
    for (const [index, shop] of shops.entries()) {
      const { data: matchId, error: matchError } = await supabase.rpc('create_public_lead_match' as any, {
        p_lead_id: leadIdStr,
        p_bodyshop_id: String(shop.id),
        p_ai_estimate_min: leadPayload.p_ai_estimate_min,
        p_ai_estimate_max: leadPayload.p_ai_estimate_max,
        p_response_deadline: deadline,
        p_distance_miles: Number((0.8 + index * 1.1).toFixed(1)),
      });

      if (matchError) {
        console.error('[lead-dispatch] match insert failed', matchError.message);
        return { ok: false, leadId: leadIdStr, error: matchError.message };
      }
      matchedShops += 1;

      if (matchId) {
        void notifyPartnerNewLead({
          matchId: String(matchId),
          leadId: leadIdStr,
          bodyshopId: String(shop.id),
        }).then((result) => {
          if (!result.ok) {
            console.warn('[lead-dispatch] partner notify failed', result.error);
          } else if (result.devMode && result.respondUrl) {
            console.info('[lead-dispatch] dev respond link', result.respondUrl);
          }
        });
      }
    }

    console.info('[lead-dispatch] success', { leadId: leadIdStr, bodyshopId: String(shops[0]?.id), matchedShops });
    return {
      ok: true,
      leadId: leadIdStr,
      bodyshopId: String(shops[0]?.id || DEMO_BODYSHOP_ID),
      matchedShops,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Lead dispatch failed.';
    console.error('[lead-dispatch] exception', msg);
    return { ok: false, error: msg };
  }
};
