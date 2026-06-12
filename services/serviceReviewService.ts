import { supabase } from './supabaseClient';

export interface ServiceReviewContext {
  valid: boolean;
  expired: boolean;
  alreadySubmitted: boolean;
  bodyshopName?: string;
  customerFirstName?: string;
  rating?: number;
  reviewComment?: string;
}

export const getServiceReviewByToken = async (token: string): Promise<ServiceReviewContext> => {
  const fallback: ServiceReviewContext = {
    valid: false,
    expired: false,
    alreadySubmitted: false,
  };

  if (!token.trim()) return fallback;

  try {
    const { data, error } = await supabase.rpc('get_service_review_by_token' as any, {
      p_token: token.trim(),
    });

    if (error || !data?.length) return fallback;

    const row = data[0];
    return {
      valid: !!row.valid,
      expired: !!row.expired,
      alreadySubmitted: !!row.already_submitted,
      bodyshopName: row.bodyshop_name ? String(row.bodyshop_name) : undefined,
      customerFirstName: row.customer_first_name ? String(row.customer_first_name) : undefined,
      rating: row.rating ? Number(row.rating) : undefined,
      reviewComment: row.review_comment ? String(row.review_comment) : undefined,
    };
  } catch {
    return fallback;
  }
};

export const submitServiceReview = async (
  token: string,
  rating: number,
  comment?: string,
): Promise<{ ok: boolean; error?: string }> => {
  try {
    const { error } = await supabase.rpc('submit_service_review' as any, {
      p_token: token.trim(),
      p_rating: rating,
      p_comment: comment?.trim() || null,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Could not submit review.',
    };
  }
};
