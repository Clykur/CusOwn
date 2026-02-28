/**
 * GET: list business images (public for customer UI).
 * POST: upload business image (owner only, must own business).
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { requireAuth } from '@/lib/utils/api-auth-pipeline';
import { userService } from '@/services/user.service';
import { mediaService } from '@/services/media.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { isValidUUID } from '@/lib/utils/security';
import {
  RATE_LIMIT_MEDIA_UPLOAD_WINDOW_MS,
  RATE_LIMIT_MEDIA_UPLOAD_MAX_PER_WINDOW,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  API_PAGINATION_DEFAULT_LIMIT,
  API_PAGINATION_MAX_LIMIT,
  IDEMPOTENCY_KEY_HEADER,
} from '@/config/constants';

const ROUTE_GET = 'GET /api/media/business/[businessId]';
const ROUTE_POST = 'POST /api/media/business/[businessId]';

const uploadRateLimit = enhancedRateLimit({
  windowMs: RATE_LIMIT_MEDIA_UPLOAD_WINDOW_MS,
  maxRequests: RATE_LIMIT_MEDIA_UPLOAD_MAX_PER_WINDOW,
  perUser: true,
  perIP: true,
  keyPrefix: 'media_upload',
});

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await context.params;
    if (!isValidUUID(businessId)) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    const url = new URL(request.url);
    const limit = Math.min(
      parseInt(url.searchParams.get('limit') ?? String(API_PAGINATION_DEFAULT_LIMIT), 10) ||
        API_PAGINATION_DEFAULT_LIMIT,
      API_PAGINATION_MAX_LIMIT
    );
    const offset = Math.max(parseInt(url.searchParams.get('offset') ?? '0', 10) || 0, 0);

    const list = await mediaService.listBusinessMedia(businessId, {
      limit,
      offset,
    });
    return successResponse({ items: list, limit, offset });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.LOADING_ERROR;
    return errorResponse(message, 500);
  }
}

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ businessId: string }> }
) {
  try {
    const rateLimitRes = await uploadRateLimit(request);
    if (rateLimitRes) return rateLimitRes;

    const auth = await requireAuth(request, ROUTE_POST);
    if (auth instanceof Response) return auth;

    const { businessId } = await context.params;
    if (!isValidUUID(businessId)) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    const businesses = await userService.getUserBusinesses(auth.user.id);
    const owns = businesses?.some((b) => b.id === businessId);
    if (!owns) {
      return errorResponse(ERROR_MESSAGES.MEDIA_BUSINESS_ACCESS_DENIED, 403);
    }

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
    const sortOrderStr = formData.get('sortOrder');
    const sortOrder =
      sortOrderStr !== null && sortOrderStr !== undefined
        ? parseInt(String(sortOrderStr), 10)
        : undefined;
    const idempotencyKey = request.headers.get(IDEMPOTENCY_KEY_HEADER)?.trim() || undefined;
    const media = await mediaService.uploadBusinessImage({
      businessId,
      file: buffer,
      contentType,
      sizeBytes,
      originalFilename: file.name || undefined,
      sortOrder: Number.isNaN(sortOrder as number) ? undefined : (sortOrder as number),
      actorId: auth.user.id,
      idempotencyKey: idempotencyKey && idempotencyKey.length <= 512 ? idempotencyKey : undefined,
      request,
    });

    return successResponse({ media }, SUCCESS_MESSAGES.MEDIA_UPLOADED);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.MEDIA_UPLOAD_FAILED;
    return errorResponse(message, 400);
  }
}
