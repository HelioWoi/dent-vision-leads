import { supabase } from './supabaseClient';

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
  targetShopName?: string;
  targetShopPrice?: number;
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

    const leadPayload = {
      customer_name: input.customerName,
      customer_email: input.customerEmail,
      customer_phone: input.customerPhone,
      postal_code: input.postalCode || input.zip || null,
      region: targetShop?.region || 'Unknown Region',
      ai_damage_category: input.damageCategory || 'Dent Repair',
      damage_location: input.location || 'Panel pending',
      dent_count: Number(input.dents || 1),
      ai_estimate_min: Number(input.estimateMin || 0),
      ai_estimate_max: Number(input.estimateMax || 0),
      status: 'booked',
      created_at: new Date().toISOString(),
    };

    const { data: leadRow, error: leadError } = await supabase
      .from('lead_requests' as any)
      .insert(leadPayload)
      .select('id')
      .single();

    if (leadError || !leadRow?.id) {
      return {
        ok: false,
        error: leadError?.message || 'Could not create booking request.',
      };
    }

    if (targetShop?.id) {
      const preferredSlot = [input.preferredDate, input.preferredTime].filter(Boolean).join(' ');
      const note = [
        `Customer requested booking${preferredSlot ? ` for ${preferredSlot}` : ''}.`,
        input.rego?.trim() ? `Vehicle REGO: ${input.rego.trim()}` : '',
        input.note?.trim() ? `Customer note: ${input.note.trim()}` : '',
      ]
        .filter(Boolean)
        .join(' ');

      const matchPayload = {
        bodyshop_id: String(targetShop.id),
        lead_id: String(leadRow.id),
        status: 'booked',
        shop_price_min: Number(input.targetShopPrice || input.estimateMin || 0),
        shop_price_max: Number(input.targetShopPrice || input.estimateMax || input.estimateMin || 0),
        shop_note: note,
        responded_at: new Date().toISOString(),
      };

      await supabase.from('shop_lead_matches' as any).insert(matchPayload);
    }

    return {
      ok: true,
      leadId: String(leadRow.id),
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Booking failed unexpectedly.',
    };
  }
};
