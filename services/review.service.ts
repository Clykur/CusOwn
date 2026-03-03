import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { ERROR_MESSAGES } from '@/config/constants';
import type { ApiResponse } from '@/types';

export type CreateReviewInput = {
  booking_id: string;
  rating: number;
  comment?: string | null;
};

export type ReviewListItem = {
  id: string;
  booking_id: string;
  business_id: string;
  user_id: string | null;
  rating: number;
  comment: string | null;
  is_hidden: boolean;
  created_at: string;
};

export type ListReviewsResult = {
  reviews: ReviewListItem[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
};

/**
 * Create a review for a confirmed booking. One review per booking; updates business aggregates atomically.
 * Caller must ensure: auth, rate limit, profanity check, and that the user is the booking's customer.
 */
export async function createReview(
  userId: string,
  input: CreateReviewInput
): Promise<{ success: true; review_id: string } | { success: false; error: string }> {
  const supabase = requireSupabaseAdmin();
  const result = await supabase.rpc('create_review_atomically', {
    p_booking_id: input.booking_id,
    p_user_id: userId,
    p_rating: input.rating,
    p_comment: input.comment ?? null,
  });

  const data = result.data as { success: boolean; error?: string; review_id?: string } | null;
  if (result.error) {
    return { success: false, error: ERROR_MESSAGES.DATABASE_ERROR };
  }
  if (data?.success === true && data.review_id) {
    return { success: true, review_id: data.review_id };
  }
  return { success: false, error: data?.error ?? ERROR_MESSAGES.DATABASE_ERROR };
}

/**
 * List visible reviews for a business with pagination. Soft-deleted users are anonymized (user_id null in response).
 */
export async function listReviewsByBusiness(
  businessId: string,
  page: number,
  limit: number
): Promise<ListReviewsResult> {
  const supabase = requireSupabaseAdmin();
  const offset = (page - 1) * limit;

  const { data: rows, error } = await supabase
    .from('reviews')
    .select('id, booking_id, business_id, user_id, rating, comment, is_hidden, created_at')
    .eq('business_id', businessId)
    .eq('is_hidden', false)
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (error) {
    return { reviews: [], total: 0, page, limit, has_more: false };
  }

  const reviews = (rows ?? []) as ReviewListItem[];
  const hasMore = reviews.length === limit;
  const total = hasMore ? offset + reviews.length + 1 : offset + reviews.length;

  const userIds = [...new Set(reviews.map((r) => r.user_id).filter(Boolean))] as string[];
  let deletedIds = new Set<string>();
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, deleted_at')
      .in('id', userIds);
    deletedIds = new Set(
      (profiles ?? [])
        .filter((p: { deleted_at: string | null }) => p.deleted_at != null)
        .map((p: { id: string }) => p.id)
    );
  }

  const anonymized = reviews.map((r) => ({
    ...r,
    user_id: r.user_id && deletedIds.has(r.user_id) ? null : r.user_id,
  }));

  return {
    reviews: anonymized,
    total: hasMore ? total : offset + anonymized.length,
    page,
    limit,
    has_more: hasMore,
  };
}

/**
 * Get reviews by booking IDs (for attaching to booking lists). Returns map of booking_id -> { rating, comment }.
 */
export async function getReviewsByBookingIds(
  bookingIds: string[]
): Promise<Map<string, { rating: number; comment: string | null }>> {
  if (bookingIds.length === 0) return new Map();
  const supabase = requireSupabaseAdmin();
  const { data: rows } = await supabase
    .from('reviews')
    .select('booking_id, rating, comment')
    .in('booking_id', bookingIds)
    .eq('is_hidden', false);
  const map = new Map<string, { rating: number; comment: string | null }>();
  (rows ?? []).forEach((r: { booking_id: string; rating: number; comment: string | null }) => {
    map.set(r.booking_id, { rating: r.rating, comment: r.comment ?? null });
  });
  return map;
}

/**
 * Admin: set review visibility (is_hidden). Recalculates business aggregates atomically.
 */
export async function setReviewHidden(
  reviewId: string,
  isHidden: boolean
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = requireSupabaseAdmin();
  const result = await supabase.rpc('set_review_hidden_atomically', {
    p_review_id: reviewId,
    p_is_hidden: isHidden,
  });

  const data = result.data as { success: boolean; error?: string } | null;
  if (result.error) {
    return { success: false, error: ERROR_MESSAGES.DATABASE_ERROR };
  }
  if (data?.success === true) {
    return { success: true };
  }
  return { success: false, error: data?.error ?? ERROR_MESSAGES.REVIEW_NOT_FOUND };
}
