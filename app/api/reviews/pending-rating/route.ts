import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getPendingRatingBooking } from '@/services/rating-prompt.service';
import { createReview } from '@/services/review.service';
import { ERROR_MESSAGES } from '@/config/constants';
import { getServerUser } from '@/lib/supabase/server-auth';

/**
 * GET /api/reviews/pending-rating
 * Returns the most recent completed booking that needs a rating from current user.
 */
export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const pendingBooking = await getPendingRatingBooking(user.id);

    return successResponse({
      booking: pendingBooking,
    });
  } catch (error) {
    console.error('[API] GET /api/reviews/pending-rating:', error);
    return errorResponse(ERROR_MESSAGES.DATABASE_ERROR, 500);
  }
}

/**
 * POST /api/reviews/pending-rating
 * Submit a rating for a pending booking.
 * Body: { booking_id: string, rating: number }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { booking_id, rating } = body;

    if (!booking_id || typeof booking_id !== 'string') {
      return errorResponse('Invalid booking_id', 400);
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return errorResponse('Rating must be between 1 and 5', 400);
    }

    const result = await createReview(user.id, {
      booking_id,
      rating,
      comment: null, // No comments for this feature
    });

    if (!result.success) {
      return errorResponse(result.error, 400);
    }

    return successResponse({
      success: true,
      review_id: result.review_id,
    });
  } catch (error) {
    console.error('[API] POST /api/reviews/pending-rating:', error);
    return errorResponse(ERROR_MESSAGES.DATABASE_ERROR, 500);
  }
}
