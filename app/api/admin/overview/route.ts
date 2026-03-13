import { NextRequest } from 'next/server';
import { adminService, FullAdminOverview } from '@/services/admin.service';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { getCache, setCache, buildCacheKey, CACHE_PREFIX, CACHE_TTL } from '@/lib/cache/cache';

const ROUTE = 'GET /api/admin/overview';
const AGGREGATED_OVERVIEW_TTL = 30;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const { searchParams } = new URL(request.url);
    const aggregated = searchParams.get('aggregated') === 'true';
    const days = Math.min(Math.max(1, parseInt(searchParams.get('days') ?? '30', 10)), 90);

    if (aggregated) {
      const cacheKey = buildCacheKey(CACHE_PREFIX.DASHBOARD, 'admin-full-overview', String(days));

      const { hit, data: cachedData } = await getCache<FullAdminOverview>(cacheKey);
      if (hit && cachedData) {
        const response = successResponse(cachedData);
        setCacheHeaders(response, AGGREGATED_OVERVIEW_TTL, AGGREGATED_OVERVIEW_TTL * 2);
        return response;
      }

      const data = await adminService.getFullAdminOverview(days);
      await setCache(cacheKey, data, AGGREGATED_OVERVIEW_TTL);

      const response = successResponse(data);
      setCacheHeaders(response, AGGREGATED_OVERVIEW_TTL, AGGREGATED_OVERVIEW_TTL * 2);
      return response;
    }

    const cacheKey = buildCacheKey(CACHE_PREFIX.DASHBOARD, 'admin-overview');

    const { hit, data: cachedData } = await getCache<unknown>(cacheKey);
    if (hit && cachedData) {
      const response = successResponse(cachedData);
      setCacheHeaders(response, CACHE_TTL.DASHBOARD, CACHE_TTL.DASHBOARD * 2);
      return response;
    }

    const data = await adminService.getAdminOverview();

    await setCache(cacheKey, data, CACHE_TTL.DASHBOARD);

    const response = successResponse(data);
    setCacheHeaders(response, CACHE_TTL.DASHBOARD, CACHE_TTL.DASHBOARD * 2);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
