import { supabase } from './supabaseClient';

export interface LeadAssignmentVerification {
  assigned: boolean;
  matchId?: string;
  matchStatus?: string;
  bodyshopName?: string;
  canBook: boolean;
}

export const verifyLeadAssignment = async (
  leadId: string,
  bodyshopId: string,
): Promise<LeadAssignmentVerification> => {
  const { data, error } = await supabase.rpc('verify_lead_bodyshop_assignment' as any, {
    p_lead_id: leadId,
    p_bodyshop_id: bodyshopId,
  });

  if (error || !data?.length) {
    return { assigned: false, canBook: false };
  }

  const row = data[0];
  return {
    assigned: true,
    matchId: row.match_id ? String(row.match_id) : undefined,
    matchStatus: row.match_status ? String(row.match_status) : undefined,
    bodyshopName: row.bodyshop_name ? String(row.bodyshop_name) : undefined,
    canBook: !!row.can_book,
  };
};
