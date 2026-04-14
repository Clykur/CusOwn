import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getServerUser } from '@/lib/supabase/server-auth';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { filterFields, validateStringLength } from '@/lib/security/input-filter';
import { containsProfanity } from '@/lib/content/profanity-filter';
import {
  createReview,
  getReviewRatingCountsForBusiness,
  listReviewsByBusiness,
} from '@/services/review.service';
import { isValidUUID } from '@/lib/utils/security';
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  VALIDATION,
  RATE_LIMIT_REVIEW_WINDOW_MS,
  RATE_LIMIT_REVIEW_MAX_PER_WINDOW,
} from '@/config/constants';

const reviewCreateRateLimit = enhancedRateLimit({
  maxRequests: RATE_LIMIT_REVIEW_MAX_PER_WINDOW,
  windowMs: RATE_LIMIT_REVIEW_WINDOW_MS,
  perIP: true,
  perUser: true,
  keyPrefix: 'review_create',
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await reviewCreateRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const user = await getServerUser(request);
    if (!user) {
      return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401);
    }

    const body = await request.json();
    const allowedFields = ['booking_id', 'rating', 'comment'] as const;
    const filtered = filterFields(body, allowedFields);

    const bookingId = filtered.booking_id;
    if (!bookingId || !isValidUUID(bookingId)) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 400);
    }

    const rating = Number(filtered.rating);
    if (
      !Number.isInteger(rating) ||
      rating < VALIDATION.REVIEW_RATING_MIN ||
      rating > VALIDATION.REVIEW_RATING_MAX
    ) {
      return errorResponse(ERROR_MESSAGES.REVIEW_INVALID_RATING, 400);
    }

    const comment = filtered.comment != null ? String(filtered.comment).trim() : undefined;
    if (
      comment !== undefined &&
      comment !== '' &&
      !validateStringLength(comment, VALIDATION.REVIEW_COMMENT_MAX_LENGTH)
    ) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }
    if (comment !== undefined && comment !== '' && containsProfanity(comment)) {
      return errorResponse(ERROR_MESSAGES.REVIEW_PROFANITY, 400);
    }

    const supabase = requireSupabaseAdmin();
    const { data: booking } = await supabase
      .from('bookings')
      .select('id, status, customer_user_id')
      .eq('id', bookingId)
      .single();

    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }
    if (booking.customer_user_id && booking.customer_user_id !== user.id) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN, 403);
    }

    const result = await createReview(user.id, {
      booking_id: bookingId,
      rating,
      comment: comment || null,
    });

    if (!result.success) {
      if (result.error === ERROR_MESSAGES.REVIEW_ALREADY_EXISTS) {
        return errorResponse(result.error, 409);
      }
      return errorResponse(result.error, 400);
    }

    return successResponse({ review_id: result.review_id }, SUCCESS_MESSAGES.REVIEW_CREATED);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get('business_id');
    const page = Math.max(1, parseInt(searchParams.get('page') ?? '1', 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(searchParams.get('limit') ?? '20', 10) || 20));

    if (!businessId || !isValidUUID(businessId)) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    const supabase = requireSupabaseAdmin();
    const [result, bizRow, rating_counts] = await Promise.all([
      listReviewsByBusiness(businessId, page, limit),
      supabase
        .from('businesses')
        .select('rating_avg, review_count')
        .eq('id', businessId)
        .maybeSingle(),
      getReviewRatingCountsForBusiness(businessId),
    ]);

    const reviews = result.reviews ?? [];
    const biz = bizRow.data as { rating_avg: number | null; review_count: number } | null;

    const reviewCount = biz?.review_count ?? result.total;
    const ratingAvg =
      biz?.rating_avg != null && Number.isFinite(Number(biz.rating_avg))
        ? Number(Number(biz.rating_avg).toFixed(1))
        : 0;

    return successResponse({
      reviews,
      rating_avg: ratingAvg,
      review_count: reviewCount,
      rating_counts,
      pagination: {
        page: result.page,
        limit: result.limit,
        total: result.total,
        has_more: result.has_more,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
