import { getBusinessCategories } from '@/services/business-category.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import {
  buildApiCacheKey,
  getCachedApiResponse,
  setCachedApiResponse,
} from '@/lib/cache/api-response-cache';
import { dedupe } from '@/lib/cache/request-dedup';
import { ERROR_MESSAGES, CACHE_TTL_STATIC_MS } from '@/config/constants';
import {
  buildApiRedisKeyFromPath,
  getApiRedisCache,
  setApiRedisCache,
  API_REDIS_TTL,
} from '@/lib/cache/api-redis-cache';

/**
 * GET /api/business-categories
 * Returns active business types (available services) for the Business type dropdown.
 * Data from DB table business_categories; cached 10 min; concurrent requests deduped.
 */
export async function GET() {
  try {
    // Check Redis cache first
    const redisKey = buildApiRedisKeyFromPath('/api/business-categories');
    const redisCached = await getApiRedisCache<{ value: string; label: string }[]>(redisKey);
    if (redisCached) {
      const response = successResponse(redisCached);
      setCacheHeaders(response, 300, 600);
      return response;
    }

    // Check in-memory cache
    const cacheKey = buildApiCacheKey('GET', '/api/business-categories');
    const cached = getCachedApiResponse<{ data: { value: string; label: string }[] }>(cacheKey);
    if (cached) {
      // Populate Redis from in-memory cache
      await setApiRedisCache(redisKey, cached.data, API_REDIS_TTL.CATEGORIES);
      const response = successResponse(cached.data);
      setCacheHeaders(response, 300, 600);
      return response;
    }

    const categories = await dedupe('categories', () => getBusinessCategories());
    // Cache in both Redis and in-memory
    await setApiRedisCache(redisKey, categories, API_REDIS_TTL.CATEGORIES);
    setCachedApiResponse(cacheKey, { data: categories }, CACHE_TTL_STATIC_MS);
    const response = successResponse(categories);
    setCacheHeaders(response, 300, 600);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
