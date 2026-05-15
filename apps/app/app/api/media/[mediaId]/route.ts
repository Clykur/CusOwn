import { NextRequest } from 'next/server';
import { 
  successResponse, 
  errorResponse, 
  requireAuth,
  userService,
  mediaService,
  isValidUUID,
  auditService
} from '@cusown/shared/server';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@cusown/config';

const ROUTE = 'DELETE /api/media/[mediaId]';

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ mediaId: string }> }
) {
  try {
    const auth = await requireAuth(request, ROUTE);
    if (auth instanceof Response) return auth;

    const { mediaId } = await context.params;
    if (!isValidUUID(mediaId)) {
      return errorResponse(ERROR_MESSAGES.MEDIA_NOT_FOUND, 404);
    }

    const media = await mediaService.getMediaById(mediaId);
    if (!media) {
      return errorResponse(ERROR_MESSAGES.MEDIA_NOT_FOUND, 404);
    }

    if (media.entity_type === 'profile') {
      if (media.entity_id !== auth.user.id) {
        return errorResponse(ERROR_MESSAGES.MEDIA_PROFILE_ACCESS_DENIED, 403);
      }
    } else {
      const businesses = await userService.getUserBusinesses(auth.user.id);
      const owns = businesses?.some((b) => b.id === media.entity_id);
      if (!owns) {
        return errorResponse(ERROR_MESSAGES.MEDIA_BUSINESS_ACCESS_DENIED, 403);
      }
    }

    await mediaService.deleteMedia(mediaId, auth.user.id);

    // Audit Log
    await auditService.createAuditLog(auth.user.id, 'media_deleted', 'media', {
      entityId: mediaId,
      oldData: media,
      description: `Media deleted by ${media.entity_type === 'profile' ? 'profile owner' : 'business owner'}`,
    });

    return successResponse({ id: mediaId }, SUCCESS_MESSAGES.MEDIA_DELETED);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    return errorResponse(message, 400);
  }
}
