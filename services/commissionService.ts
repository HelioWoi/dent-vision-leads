import { supabase } from './supabaseClient';

export type CommissionStatus = 'pending' | 'earned' | 'invoiced' | 'paid' | 'cancelled';

export interface CommissionLedgerEntry {
  id: string;
  matchId: string;
  leadId: string;
  bodyshopId: string;
  jobValue: number;
  commissionRate: number;
  commissionAmount: number;
  status: CommissionStatus;
  bookedAt?: string;
  completedAt?: string;
  customerRef?: string;
  serviceReviewRating?: number;
  serviceReviewSubmitted?: boolean;
}

export interface CommissionSummary {
  pendingJobs: number;
  pendingValue: number;
  earnedJobs: number;
  earnedCommission: number;
  paidCommission: number;
  totalDue: number;
  entries: CommissionLedgerEntry[];
}

export interface CompleteJobResult {
  ok: boolean;
  error?: string;
  matchId?: string;
  jobValue?: number;
  commissionAmount?: number;
  reviewToken?: string;
  customerEmail?: string;
  customerName?: string;
  bodyshopName?: string;
  emailSent?: boolean;
  reviewUrl?: string;
  devMode?: boolean;
}

const mapLedgerRow = (row: any, extras?: Partial<CommissionLedgerEntry>): CommissionLedgerEntry => ({
  id: String(row.id),
  matchId: String(row.match_id),
  leadId: String(row.lead_id),
  bodyshopId: String(row.bodyshop_id),
  jobValue: Number(row.job_value || 0),
  commissionRate: Number(row.commission_rate || 0.1),
  commissionAmount: Number(row.commission_amount || 0),
  status: (row.status || 'pending') as CommissionStatus,
  bookedAt: row.booked_at || undefined,
  completedAt: row.completed_at || undefined,
  ...extras,
});

export const fetchCommissionLedger = async (bodyshopId: string): Promise<CommissionSummary> => {
  const empty: CommissionSummary = {
    pendingJobs: 0,
    pendingValue: 0,
    earnedJobs: 0,
    earnedCommission: 0,
    paidCommission: 0,
    totalDue: 0,
    entries: [],
  };

  try {
    const { data: ledgerRows, error } = await supabase
      .from('commission_ledger' as any)
      .select('*')
      .eq('bodyshop_id', bodyshopId)
      .order('created_at', { ascending: false });

    if (error || !ledgerRows?.length) return empty;

    const leadIds = [...new Set(ledgerRows.map((row: any) => String(row.lead_id)))];
    const matchIds = ledgerRows.map((row: any) => String(row.match_id));

    const [{ data: leads }, { data: reviews }] = await Promise.all([
      supabase.from('lead_requests' as any).select('id,customer_name').in('id', leadIds),
      supabase
        .from('service_review_requests' as any)
        .select('match_id,rating,status')
        .in('match_id', matchIds),
    ]);

    const leadNameById = new Map<string, string>();
    for (const lead of leads || []) {
      leadNameById.set(String(lead.id), String(lead.customer_name || 'Customer'));
    }

    const reviewByMatch = new Map<string, { rating?: number; submitted: boolean }>();
    for (const review of reviews || []) {
      reviewByMatch.set(String(review.match_id), {
        rating: review.rating ? Number(review.rating) : undefined,
        submitted: review.status === 'submitted',
      });
    }

    const entries = ledgerRows.map((row: any) => {
      const leadId = String(row.lead_id);
      const matchId = String(row.match_id);
      const name = leadNameById.get(leadId) || 'Customer';
      const review = reviewByMatch.get(matchId);
      const first = name.split(' ')[0] || 'Customer';
      const lastInitial = name.split(' ')[1]?.[0];
      return mapLedgerRow(row, {
        customerRef: lastInitial ? `${first} ${lastInitial}.` : first,
        serviceReviewRating: review?.rating,
        serviceReviewSubmitted: review?.submitted,
      });
    });

    const pending = entries.filter((e) => e.status === 'pending');
    const earned = entries.filter((e) => e.status === 'earned' || e.status === 'invoiced');
    const paid = entries.filter((e) => e.status === 'paid');

    return {
      pendingJobs: pending.length,
      pendingValue: pending.reduce((sum, e) => sum + e.jobValue, 0),
      earnedJobs: earned.length,
      earnedCommission: earned.reduce((sum, e) => sum + e.commissionAmount, 0),
      paidCommission: paid.reduce((sum, e) => sum + e.commissionAmount, 0),
      totalDue: earned.reduce((sum, e) => sum + e.commissionAmount, 0),
      entries,
    };
  } catch {
    return empty;
  }
};

const buildReviewUrl = (token: string) => {
  const origin = typeof window !== 'undefined' ? window.location.origin : '';
  const path = typeof window !== 'undefined' ? window.location.pathname : '/';
  return `${origin}${path}#/service-review?token=${encodeURIComponent(token)}`;
};

export const completePartnerJob = async (
  bodyshopId: string,
  leadId: string,
  finalJobValue?: number,
): Promise<CompleteJobResult> => {
  try {
    const { data, error } = await supabase.rpc('complete_partner_job' as any, {
      p_bodyshop_id: bodyshopId,
      p_lead_id: leadId,
      p_final_job_value: finalJobValue ?? null,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    const row = data as Record<string, unknown>;
    const reviewToken = String(row.review_token || '');
    const customerEmail = row.customer_email ? String(row.customer_email) : undefined;
    const reviewUrl = reviewToken ? buildReviewUrl(reviewToken) : undefined;

    let emailSent = false;
    let devMode = false;

    if (reviewToken && customerEmail && reviewUrl) {
      const envBag = (import.meta as any).env || {};
      const baseUrl = envBag.VITE_SUPABASE_URL
        ? `${envBag.VITE_SUPABASE_URL}/functions/v1`
        : 'http://127.0.0.1:54321/functions/v1';
      const anonKey = envBag.VITE_SUPABASE_ANON_KEY;

      const emailRes = await fetch(`${baseUrl}/send-service-review-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(anonKey ? { Authorization: `Bearer ${anonKey}`, apikey: anonKey } : {}),
        },
        body: JSON.stringify({
          token: reviewToken,
          customerEmail,
          customerName: row.customer_name ? String(row.customer_name) : undefined,
          bodyshopName: String(row.bodyshop_name || 'Your bodyshop'),
          reviewUrl,
          leadId,
          bodyshopId,
        }),
      });

      const emailJson = await emailRes.json();
      emailSent = !!emailJson?.data?.sent;
      devMode = !!emailJson?.data?.devMode;

      if (emailSent || devMode) {
        await supabase.rpc('mark_service_review_email_sent' as any, { p_token: reviewToken });
      }
    }

    return {
      ok: true,
      matchId: row.match_id ? String(row.match_id) : undefined,
      jobValue: row.job_value ? Number(row.job_value) : undefined,
      commissionAmount: row.commission_amount ? Number(row.commission_amount) : undefined,
      reviewToken,
      customerEmail,
      customerName: row.customer_name ? String(row.customer_name) : undefined,
      bodyshopName: row.bodyshop_name ? String(row.bodyshop_name) : undefined,
      emailSent,
      reviewUrl,
      devMode,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not complete job.',
    };
  }
};
