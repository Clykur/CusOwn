import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { setReviewHidden } from '@/services/review.service';
import { isValidUUID } from '@/lib/utils/security';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';

const ROUTE = 'PATCH /api/admin/reviews/[id]';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const { id: reviewId } = await params;
    if (!reviewId || !isValidUUID(reviewId)) {
      return errorResponse(ERROR_MESSAGES.REVIEW_NOT_FOUND, 400);
    }

    const body = await request.json().catch(() => ({}));
    const isHidden = body.is_hidden;
    if (typeof isHidden !== 'boolean') {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    const result = await setReviewHidden(reviewId, isHidden);
    if (!result.success) {
      return errorResponse(result.error, 404);
    }

    return successResponse({ is_hidden: isHidden }, SUCCESS_MESSAGES.REVIEW_VISIBILITY_UPDATED);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
