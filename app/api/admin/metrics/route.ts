import { NextRequest } from 'next/server';
import { adminService } from '@/services/admin.service';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import {
  buildApiCacheKey,
  getCachedApiResponse,
  setCachedApiResponse,
  API_CACHE_TTL,
} from '@/lib/cache/api-response-cache';
import { dedupe } from '@/lib/cache/request-dedup';
import { hashToken } from '@/lib/utils/token-hash.server';

const ROUTE = 'GET /api/admin/metrics';

function getTokenHash(request: NextRequest): string {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : '';
  return token ? hashToken(token) : 'admin';
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const scope = getTokenHash(request);
    const cacheKey = buildApiCacheKey('GET', '/api/admin/metrics', {}, scope);
    const cached =
      getCachedApiResponse<Awaited<ReturnType<typeof adminService.getPlatformMetrics>>>(cacheKey);
    if (cached) return successResponse(cached);

    const metrics = await dedupe(cacheKey, () => adminService.getPlatformMetrics());
    setCachedApiResponse(cacheKey, metrics, API_CACHE_TTL.DEFAULT);
    return successResponse(metrics);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
