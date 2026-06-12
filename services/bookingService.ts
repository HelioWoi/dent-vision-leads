import { supabase } from './supabaseClient';
import { DEMO_BODYSHOP_ID } from './leadDispatchService';
import { verifyLeadAssignment } from './leadAssignmentService';

export interface BookingSubmissionInput {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  rego?: string;
  postalCode?: string;
  preferredDate: string;
  preferredTime: string;
  note?: string;
  zip?: string;
  damageCategory?: string;
  location?: string;
  dents?: number;
  estimateMin?: number;
  estimateMax?: number;
  pdrEstimateMin?: number;
  pdrEstimateMax?: number;
  paintRepairNeeded?: boolean;
  targetShopName?: string;
  targetShopPrice?: number;
  /** Existing lead from estimate dispatch — preferred path */
  existingLeadId?: string;
  targetBodyshopId?: string;
}

export interface BookingSubmissionResult {
  ok: boolean;
  leadId?: string;
  error?: string;
}

const pickTargetShop = async (targetShopName?: string) => {
  const { data, error } = await supabase
    .from('bodyshops' as any)
    .select('id,business_name,region,active_status')
    .limit(50);

  if (error || !data?.length) return null;

  const cleanedTarget = String(targetShopName || '').trim().toLowerCase();
  const activeShops = data.filter((shop: any) => shop.active_status !== false);
  const pool = activeShops.length ? activeShops : data;

  if (!cleanedTarget) return pool[0];

  const exact = pool.find((shop: any) => String(shop.business_name || '').trim().toLowerCase() === cleanedTarget);
  if (exact) return exact;

  const partial = pool.find((shop: any) => String(shop.business_name || '').toLowerCase().includes(cleanedTarget));
  if (partial) return partial;

  return pool[0];
};

export const submitBookingRequest = async (input: BookingSubmissionInput): Promise<BookingSubmissionResult> => {
  try {
    const targetShop = await pickTargetShop(input.targetShopName);
    const bodyshopId = input.targetBodyshopId || targetShop?.id || DEMO_BODYSHOP_ID;
    const shopPrice = Number(input.targetShopPrice || input.estimateMin || 0);
    const note = [
      input.note?.trim() ? `Customer note: ${input.note.trim()}` : '',
    ].filter(Boolean).join(' ');

    if (input.existingLeadId) {
      const assignment = await verifyLeadAssignment(input.existingLeadId, bodyshopId);

      if (!assignment.assigned) {
        return {
          ok: false,
          error: 'This booking is not linked to the selected bodyshop. Please restart from your quote.',
        };
      }

      if (!assignment.canBook) {
        return {
          ok: false,
          error: assignment.matchStatus === 'booked'
            ? 'This job is already booked.'
            : 'The bodyshop must send a quote before you can book. Please wait for their response.',
        };
      }

      const { data: matchId, error } = await supabase.rpc('book_existing_lead' as any, {
        p_lead_id: input.existingLeadId,
        p_bodyshop_id: bodyshopId,
        p_customer_phone: input.customerPhone,
        p_vehicle_rego: input.rego || null,
        p_preferred_date: input.preferredDate || null,
        p_preferred_time: input.preferredTime || null,
        p_customer_note: note || null,
        p_shop_price: shopPrice || null,
      });

      if (error) {
        return { ok: false, error: error.message || 'Could not confirm booking on existing lead.' };
      }

      return { ok: true, leadId: input.existingLeadId, matchId: matchId ? String(matchId) : undefined } as BookingSubmissionResult;
    }

    const { data: leadId, error: leadError } = await supabase.rpc('create_public_lead' as any, {
      p_customer_name: input.customerName,
      p_customer_email: input.customerEmail,
      p_postal_code: input.postalCode || input.zip || null,
      p_region: targetShop?.region || 'Sunshine Coast, QLD',
      p_ai_damage_category: input.damageCategory || 'Dent Repair',
      p_damage_location: input.location || 'Panel pending',
      p_dent_count: Number(input.dents || 1),
      p_ai_estimate_min: Number(input.pdrEstimateMin ?? (input.estimateMin || 0)),
      p_ai_estimate_max: Number(input.pdrEstimateMax ?? (input.estimateMax || 0)),
      p_ai_pdr_estimate_min: Number(input.pdrEstimateMin ?? (input.estimateMin || 0)),
      p_ai_pdr_estimate_max: Number(input.pdrEstimateMax ?? (input.estimateMax || 0)),
      p_paint_repair_needed: !!input.paintRepairNeeded,
      p_customer_comment: input.note || null,
    });

    if (leadError || !leadId) {
      return { ok: false, error: leadError?.message || 'Could not create booking request.' };
    }

    const leadIdStr = String(leadId);
    const { error: bookError } = await supabase.rpc('book_existing_lead' as any, {
      p_lead_id: leadIdStr,
      p_bodyshop_id: bodyshopId,
      p_customer_phone: input.customerPhone,
      p_vehicle_rego: input.rego || null,
      p_preferred_date: input.preferredDate || null,
      p_preferred_time: input.preferredTime || null,
      p_customer_note: note || null,
      p_shop_price: shopPrice || null,
    });

    if (bookError) {
      return { ok: false, leadId: leadIdStr, error: bookError.message };
    }

    return { ok: true, leadId: leadIdStr };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Booking failed unexpectedly.',
    };
  }
};
