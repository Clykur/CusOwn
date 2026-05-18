import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  requireAuth,
  getPendingRatingBookings,
  createReview,
  auditService,
  isValidUUID,
} from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';

const ROUTE_GET = 'GET /api/reviews/pending-rating';
const ROUTE_POST = 'POST /api/reviews/pending-rating';

/**
 * GET /api/reviews/pending-rating
 * Returns all completed bookings that need a rating from current user.
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ROUTE_GET);
    if (auth instanceof Response) return auth;

    const pendingBookings = await getPendingRatingBookings(auth.user.id);

    return successResponse({
      bookings: pendingBookings,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

/**
 * POST /api/reviews/pending-rating
 * Submit a rating for a pending booking.
 * Body: { booking_id: string, rating: number }
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ROUTE_POST);
    if (auth instanceof Response) return auth;

    const body = await request.json();
    const { booking_id, rating } = body;

    if (!booking_id || !isValidUUID(booking_id)) {
      return errorResponse('Invalid booking_id', 400);
    }

    if (!rating || typeof rating !== 'number' || rating < 1 || rating > 5) {
      return errorResponse('Rating must be between 1 and 5', 400);
    }

    const result = await createReview(auth.user.id, {
      booking_id,
      rating,
      comment: null,
    });

    if (!result.success) {
      return errorResponse(result.error, 400);
    }

    // Audit Log
    await auditService.createAuditLog(auth.user.id, 'review_created', 'review', {
      entityId: result.review_id as string,
      newData: { booking_id, rating, comment: null },
      description: `Review created for booking ${booking_id} via pending-rating API`,
    });

    return successResponse({
      success: true,
      review_id: result.review_id,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
