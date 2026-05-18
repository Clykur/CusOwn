import {
  successResponse,
  errorResponse,
  setCacheHeaders,
  applyActiveBusinessFilters,
  buildApiRedisKeyFromPath,
  getApiRedisCache,
  setApiRedisCache,
  API_REDIS_TTL,
  requireSupabaseAdmin,
} from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';

export async function GET() {
  try {
    // Check Redis cache first
    const redisKey = buildApiRedisKeyFromPath('/api/salons/locations');
    const redisCached = await getApiRedisCache<string[]>(redisKey);
    if (redisCached) {
      const response = successResponse(redisCached);
      setCacheHeaders(response, API_REDIS_TTL.LOCATIONS, API_REDIS_TTL.LOCATIONS * 2);
      return response;
    }

    const supabaseAdmin = requireSupabaseAdmin();
    if (!supabaseAdmin) {
      console.error('[Locations API] Supabase admin client not available');
      return errorResponse('Database not configured', 500);
    }

    // Only include locations from active, non-deleted businesses
    let query = supabaseAdmin.from('businesses').select('location');
    query = applyActiveBusinessFilters(query);
    const { data, error } = await query;

    if (error) {
      console.error('[Locations API] Database error:', error);
      return errorResponse(error.message || ERROR_MESSAGES.DATABASE_ERROR, 500);
    }

    // Filter out null/empty locations and get unique values
    const locations = Array.from(
      new Set(
        (data || [])
          .map((s) => s.location)
          .filter((l): l is string => Boolean(l) && typeof l === 'string' && l.trim() !== '')
      )
    ).sort();

    // Cache in Redis
    await setApiRedisCache(redisKey, locations, API_REDIS_TTL.LOCATIONS);

    const response = successResponse(locations);
    setCacheHeaders(response, API_REDIS_TTL.LOCATIONS, API_REDIS_TTL.LOCATIONS * 2);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error('[Locations API] Error:', message);
    return errorResponse(message, 500);
  }
}
