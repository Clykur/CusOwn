import { NextRequest } from 'next/server';
import { 
  successResponse, 
  errorResponse, 
  getServerUser, 
  mediaService, 
  enhancedRateLimit, 
  isValidUUID 
} from '@cusown/shared/server';
import { checkIsAdmin } from '@cusown/shared/server';
import { ERROR_MESSAGES, MEDIA_CACHE_CONTROL_HEADER } from '@cusown/config';
import { env } from '@cusown/config';

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

    const response = successResponse({
      url: result.url,
      expiresAt: result.expiresAt,
    });
    if (media.entity_type === 'business') {
      response.headers.set('Cache-Control', MEDIA_CACHE_CONTROL_HEADER);
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.UNEXPECTED_ERROR;
    return errorResponse(message, 500);
  }
}