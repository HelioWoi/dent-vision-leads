import { supabase } from './supabaseClient';
import { DEMO_BODYSHOP_ID } from './leadDispatchService';

export type AvailabilityPeriod = 'morning' | 'afternoon';

export interface AvailabilitySlot {
  slotDate: string;
  timePeriod: AvailabilityPeriod;
  timeLabel: string;
  spotsLeft: number;
}

export interface PartnerAvailabilitySlot extends AvailabilitySlot {
  isOpen: boolean;
  capacity: number;
  bookedCount: number;
}

const mapPublicSlot = (row: any): AvailabilitySlot => ({
  slotDate: String(row.slot_date).slice(0, 10),
  timePeriod: row.time_period as AvailabilityPeriod,
  timeLabel: String(row.time_label || row.time_period),
  spotsLeft: Number(row.spots_left ?? 0),
});

const mapAdminSlot = (row: any): PartnerAvailabilitySlot => ({
  ...mapPublicSlot(row),
  isOpen: row.is_open !== false,
  capacity: Number(row.capacity ?? 1),
  bookedCount: Number(row.booked_count ?? 0),
});

export const fetchBodyshopAvailability = async (
  bodyshopId: string = DEMO_BODYSHOP_ID,
  days = 42,
): Promise<AvailabilitySlot[]> => {
  const { data, error } = await supabase.rpc('get_bodyshop_availability' as any, {
    p_bodyshop_id: bodyshopId,
    p_days: days,
  });

  if (error) {
    console.warn('[availability] fetch error', error.message);
    return [];
  }

  return (data || []).map(mapPublicSlot);
};

export const fetchPartnerAvailability = async (
  bodyshopId: string,
  days = 42,
): Promise<PartnerAvailabilitySlot[]> => {
  const { data, error } = await supabase.rpc('get_bodyshop_availability_admin' as any, {
    p_bodyshop_id: bodyshopId,
    p_days: days,
  });

  if (error) {
    console.warn('[availability] partner fetch error', error.message);
    return [];
  }

  return (data || []).map(mapAdminSlot);
};

export const setPartnerSlotOpen = async (
  bodyshopId: string,
  slotDate: string,
  timePeriod: AvailabilityPeriod,
  isOpen: boolean,
): Promise<boolean> => {
  const { error } = await supabase.rpc('set_bodyshop_slot_open' as any, {
    p_bodyshop_id: bodyshopId,
    p_slot_date: slotDate,
    p_time_period: timePeriod,
    p_is_open: isOpen,
  });

  if (error) {
    console.warn('[availability] set slot error', error.message);
    return false;
  }
  return true;
};

export const groupSlotsByDate = (slots: AvailabilitySlot[]) => {
  const map = new Map<string, AvailabilitySlot[]>();
  for (const slot of slots) {
    const list = map.get(slot.slotDate) || [];
    list.push(slot);
    map.set(slot.slotDate, list);
  }
  return map;
};
