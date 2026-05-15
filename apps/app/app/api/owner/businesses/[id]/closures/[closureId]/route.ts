import { NextRequest } from 'next/server';
import { 
  requireOwner,
  successResponse,
  errorResponse,
  isValidUUID,
  userOwnsBusinessId,
  downtimeService,
  invalidateBusinessCache,
  getUserFriendlyError
} from '@cusown/shared/server';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@cusown/config';

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
    const friendlyMessage = getUserFriendlyError(err);
    return errorResponse(friendlyMessage, 500);
  }
}
