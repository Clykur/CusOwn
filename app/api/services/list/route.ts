import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { serviceService } from '@/services/service.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import {
  buildApiCacheKey,
  getCachedApiResponse,
  setCachedApiResponse,
} from '@/lib/cache/api-response-cache';
import { dedupe } from '@/lib/cache/request-dedup';
import { ERROR_MESSAGES, CACHE_TTL_API_LONG_MS } from '@/config/constants';
import {
  buildApiRedisKeyFromPath,
  getApiRedisCache,
  setApiRedisCache,
  API_REDIS_TTL,
} from '@/lib/cache/api-redis-cache';

const servicesListRateLimit = enhancedRateLimit({
  maxRequests: 50,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'services-list',
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await servicesListRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const businessId = request.nextUrl.searchParams.get('businessId');
    if (!businessId || !isValidUUID(businessId)) {
      return errorResponse('Invalid or missing businessId', 400);
    }

    const activeOnly = request.nextUrl.searchParams.get('active_only') !== 'false';

    // Check Redis cache first
    const redisKey = buildApiRedisKeyFromPath('/api/services/list', {
      businessId,
      active_only: String(activeOnly),
    });
    const redisCached = await getApiRedisCache<unknown[]>(redisKey);
    if (redisCached) {
      return successResponse(redisCached);
    }

    // Check in-memory cache
    const cacheKey = buildApiCacheKey('GET', '/api/services/list', {
      businessId,
      active_only: String(activeOnly),
    });
    const cached = getCachedApiResponse<{ data: unknown }>(cacheKey);
    if (cached) {
      // Populate Redis from in-memory cache
      await setApiRedisCache(redisKey, cached.data, API_REDIS_TTL.SERVICES);
      return successResponse(cached.data);
    }

    const services = await dedupe(`services:${businessId}:${activeOnly}`, () =>
      serviceService.getServicesByBusiness(businessId, activeOnly)
    );
    // Cache in both Redis and in-memory
    await setApiRedisCache(redisKey, services, API_REDIS_TTL.SERVICES);
    setCachedApiResponse(cacheKey, { data: services }, CACHE_TTL_API_LONG_MS);
    return successResponse(services);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
