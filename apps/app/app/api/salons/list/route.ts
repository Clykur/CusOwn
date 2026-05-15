import { NextRequest } from 'next/server';
import { 
  successResponse, 
  errorResponse, 
  getClientIp, 
  setCacheHeaders,
  applyActiveBusinessFilters,
  buildApiRedisKeyFromPath,
  getApiRedisCache,
  setApiRedisCache,
  API_REDIS_TTL,
  requireSupabaseAdmin
} from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';

export async function GET(request: NextRequest) {
  const clientIP = getClientIp(request);

  try {
    const { searchParams } = new URL(request.url);
    const location = searchParams.get('location');

    // SECURITY: Sanitize location parameter
    let sanitizedLocation: string | null = null;
    if (location) {
      const { sanitizeString } = await import('@cusown/shared/server');
      const sanitized = sanitizeString(location);
      if (sanitized.length > 0 && sanitized.length <= 200) {
        sanitizedLocation = sanitized;
      } else if (sanitized.length > 200) {
        console.warn(`[SECURITY] Location parameter too long from IP: ${clientIP}`);
        return errorResponse('Invalid location parameter', 400);
      }
    }

    // Check Redis cache first
    const redisKey = buildApiRedisKeyFromPath('/api/salons/list', {
      location: sanitizedLocation || undefined,
    });
    const redisCached = await getApiRedisCache<unknown[]>(redisKey);
    if (redisCached) {
      const response = successResponse(redisCached);
      setCacheHeaders(response, 300, 600);
      return response;
    }

    const supabaseAdmin = requireSupabaseAdmin();
    if (!supabaseAdmin) {
      return errorResponse('Database not configured', 500);
    }

    // SECURITY: Public endpoint - only return safe, minimal fields
    // Exclude: owner_name (PII), created_at (enumeration aid), owner_user_id
    // Include: id needed for reviews API, rating_avg and review_count for display
    let query = supabaseAdmin
      .from('businesses')
      .select(
        'id, salon_name, booking_link, address, location, category, opening_time, closing_time, slot_duration, rating_avg, review_count'
      );
    // Only show active, non-deleted businesses
    query = applyActiveBusinessFilters(query).order('salon_name', {
      ascending: true,
    });

    if (sanitizedLocation) {
      query = query.ilike('location', `%${sanitizedLocation}%`);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    // Cache in Redis
    await setApiRedisCache(redisKey, data || [], API_REDIS_TTL.SALONS_LIST);

    const response = successResponse(data || []);
    setCacheHeaders(response, 300, 600);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
