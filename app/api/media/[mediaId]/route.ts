/**
 * DELETE /api/media/[mediaId] — delete a media record (soft delete + remove from storage).
 * Caller must own the business (for business media) or be the profile owner (for profile media).
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth } from '@/lib/utils/api-auth-pipeline';
import { userService } from '@/services/user.service';
import { mediaService } from '@/services/media.service';
import { isValidUUID } from '@/lib/utils/security';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';

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
    return successResponse({ id: mediaId }, SUCCESS_MESSAGES.MEDIA_DELETED);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    return errorResponse(message, 400);
  }
}
