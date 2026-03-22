import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ignoreRatingPrompt } from '@/services/rating-prompt.service';
import { ERROR_MESSAGES } from '@/config/constants';
import { getServerUser } from '@/lib/supabase/server-auth';

/**
 * POST /api/reviews/ignore
 * Mark a booking's rating prompt as ignored.
 * User will not be asked to rate this booking again.
 * Body: { booking_id: string }
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const body = await request.json();
    const { booking_id } = body;

    if (!booking_id || typeof booking_id !== 'string') {
      return errorResponse('Invalid booking_id', 400);
    }

    const result = await ignoreRatingPrompt(booking_id, user.id);

    if (!result.success) {
      return errorResponse(result.error || ERROR_MESSAGES.DATABASE_ERROR, 400);
    }

    return successResponse({
      success: true,
    });
  } catch (error) {
    console.error('[API] POST /api/reviews/ignore:', error);
    return errorResponse(ERROR_MESSAGES.DATABASE_ERROR, 500);
  }
}
