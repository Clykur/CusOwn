/**
 * GET /api/media/signed-url?mediaId= — get signed URL for a media record.
 * Business media: public (anyone can request URL for display).
 * Profile media: only the profile owner (or admin) can request.
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getServerUser } from '@/lib/supabase/server-auth';
import { mediaService } from '@/services/media.service';
import { checkIsAdmin } from '@/lib/utils/admin';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { isValidUUID } from '@/lib/utils/security';
import { ERROR_MESSAGES } from '@/config/constants';
import { env } from '@/config/env';

const ROUTE = 'GET /api/media/signed-url';

const signedUrlRateLimit = enhancedRateLimit({
  maxRequests: 100,
  windowMs: 60_000,
  perIP: true,
  perUser: true,
  keyPrefix: 'media_signed_url',
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitRes = await signedUrlRateLimit(request);
    if (rateLimitRes) return rateLimitRes;

    const url = new URL(request.url);
    const mediaId = url.searchParams.get('mediaId');
    if (!mediaId || !isValidUUID(mediaId)) {
      return errorResponse(ERROR_MESSAGES.MEDIA_NOT_FOUND, 404);
    }

    const media = await mediaService.getMediaById(mediaId);
    if (!media) {
      return errorResponse(ERROR_MESSAGES.MEDIA_NOT_FOUND, 404);
    }

    if (media.entity_type === 'profile') {
      const user = await getServerUser(request);
      const isOwner = user?.id === media.entity_id;
      const isAdmin = user ? await checkIsAdmin(user.id) : false;
      if (!isOwner && !isAdmin) {
        return errorResponse(ERROR_MESSAGES.MEDIA_PROFILE_ACCESS_DENIED, 403);
      }
    }

    const result = await mediaService.createSignedUrl(mediaId, env.security.signedUrlTtlSeconds);
    if (!result) {
      return errorResponse(ERROR_MESSAGES.MEDIA_UPLOAD_FAILED, 500);
    }

    return successResponse({
      url: result.url,
      expiresAt: result.expiresAt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    return errorResponse(message, 500);
  }
}
