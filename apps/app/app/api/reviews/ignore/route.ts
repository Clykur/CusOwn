import { NextRequest } from 'next/server';
import { 
  successResponse, 
  errorResponse, 
  requireAuth,
  ignoreRatingPrompt,
  auditService,
  isValidUUID
} from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';

const ROUTE = 'POST /api/reviews/ignore';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ROUTE);
    if (auth instanceof Response) return auth;

    const body = await request.json();
    const { booking_id } = body;

    if (!booking_id || !isValidUUID(booking_id)) {
      return errorResponse('Invalid booking_id', 400);
    }

    const result = await ignoreRatingPrompt(booking_id, auth.user.id);

    if (!result.success) {
      return errorResponse(result.error || ERROR_MESSAGES.DATABASE_ERROR, 400);
    }

    // Audit Log
    await auditService.createAuditLog(auth.user.id, 'review_prompt_ignored', 'review', {
      entityId: booking_id,
      description: `User ignored review prompt for booking ${booking_id}`,
    });

    return successResponse({
      success: true,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
