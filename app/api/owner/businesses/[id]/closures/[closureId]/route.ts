import { NextRequest } from 'next/server';
import { requireOwner } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';
import { isValidUUID } from '@/lib/utils/security';
import { userOwnsBusinessId } from '@/lib/utils/owner-business-guard.server';
import { downtimeService } from '@/services/downtime.service';
import { invalidateBusinessCache } from '@/lib/cache/cache';

const ROUTE = 'DELETE /api/owner/businesses/[id]/closures/[closureId]';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; closureId: string }> }
) {
  try {
    const auth = await requireOwner(request, ROUTE);
    if (auth instanceof Response) return auth;

    const { id: businessId, closureId } = await params;
    if (!isValidUUID(businessId) || !isValidUUID(closureId)) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    if (!(await userOwnsBusinessId(auth.user.id, businessId))) {
      return errorResponse(ERROR_MESSAGES.FORBIDDEN, 403);
    }

    const removed = await downtimeService.removeClosureForBusiness(closureId, businessId);
    if (!removed) {
      return errorResponse(ERROR_MESSAGES.NOT_FOUND, 404);
    }
    await invalidateBusinessCache(businessId);
    return successResponse(null, SUCCESS_MESSAGES.UPDATED_SUCCESSFULLY);
  } catch (err) {
    const message = err instanceof Error ? err.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
