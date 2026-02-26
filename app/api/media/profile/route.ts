/**
 * POST /api/media/profile — upload profile image (owner or customer).
 * Auth required; user can only upload for self.
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth } from '@/lib/utils/api-auth-pipeline';
import { mediaService } from '@/services/media.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import {
  RATE_LIMIT_MEDIA_UPLOAD_WINDOW_MS,
  RATE_LIMIT_MEDIA_UPLOAD_MAX_PER_WINDOW,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  IDEMPOTENCY_KEY_HEADER,
} from '@/config/constants';

const ROUTE = 'POST /api/media/profile';

const uploadRateLimit = enhancedRateLimit({
  windowMs: RATE_LIMIT_MEDIA_UPLOAD_WINDOW_MS,
  maxRequests: RATE_LIMIT_MEDIA_UPLOAD_MAX_PER_WINDOW,
  perUser: true,
  perIP: true,
  keyPrefix: 'media_upload',
});

export async function POST(request: NextRequest) {
  try {
    const rateLimitRes = await uploadRateLimit(request);
    if (rateLimitRes) return rateLimitRes;

    const auth = await requireAuth(request, ROUTE);
    if (auth instanceof Response) return auth;

    const formData = await request.formData();
    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return errorResponse(ERROR_MESSAGES.MEDIA_FILE_TYPE_INVALID, 400);
    }

    const contentType = file.type || 'application/octet-stream';
    const sizeBytes = file.size;
    const valid = mediaService.validateUpload(contentType, sizeBytes);
    if (!valid.ok) {
      return errorResponse(valid.error ?? ERROR_MESSAGES.MEDIA_FILE_TYPE_INVALID, 400);
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const idempotencyKey = request.headers.get(IDEMPOTENCY_KEY_HEADER)?.trim() || undefined;
    const media = await mediaService.uploadProfileImage({
      userId: auth.user.id,
      file: buffer,
      contentType,
      sizeBytes,
      originalFilename: file.name || undefined,
      idempotencyKey: idempotencyKey && idempotencyKey.length <= 512 ? idempotencyKey : undefined,
      request,
    });

    return successResponse({ media }, SUCCESS_MESSAGES.PROFILE_IMAGE_UPDATED);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.MEDIA_UPLOAD_FAILED;
    return errorResponse(message, 400);
  }
}
