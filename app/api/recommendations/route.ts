import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getServerUser } from '@/lib/supabase/server-auth';
import { getRecommendations } from '@/services/recommendation.service';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { parseAndValidateCoordinates, validateRadius } from '@/lib/utils/geo';
import {
  ERROR_MESSAGES,
  RECOMMENDATION_CACHE_TTL_SECONDS,
  RECOMMENDATION_PAGE_MIN,
  RECOMMENDATION_PAGE_MAX,
  RECOMMENDATION_LIMIT_MIN,
  RECOMMENDATION_LIMIT_MAX,
  RECOMMENDATION_DEFAULT_LIMIT,
  RECOMMENDATION_DEFAULT_RADIUS_KM,
} from '@/config/constants';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';

const recommendationsRateLimit = enhancedRateLimit({
  maxRequests: 30,
  windowMs: 60_000,
  perIP: true,
  perUser: true,
  keyPrefix: 'recommendations',
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await recommendationsRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const { searchParams } = new URL(request.url);
    const pageRaw = searchParams.get('page');
    const limitRaw = searchParams.get('limit');
    const latStr = searchParams.get('latitude');
    const lngStr = searchParams.get('longitude');
    const radiusStr = searchParams.get('radius_km');

    const page = pageRaw
      ? Math.max(
          RECOMMENDATION_PAGE_MIN,
          Math.min(RECOMMENDATION_PAGE_MAX, parseInt(pageRaw, 10) || RECOMMENDATION_PAGE_MIN)
        )
      : RECOMMENDATION_PAGE_MIN;
    const limit = limitRaw
      ? Math.max(
          RECOMMENDATION_LIMIT_MIN,
          Math.min(RECOMMENDATION_LIMIT_MAX, parseInt(limitRaw, 10) || RECOMMENDATION_DEFAULT_LIMIT)
        )
      : RECOMMENDATION_DEFAULT_LIMIT;
    let latitude: number | null = null;
    let longitude: number | null = null;
    if (latStr != null && lngStr != null) {
      try {
        const coords = parseAndValidateCoordinates(latStr, lngStr);
        latitude = coords.lat;
        longitude = coords.lng;
      } catch {
        return errorResponse(ERROR_MESSAGES.GEO_INVALID_COORDINATES, 400);
      }
    }
    const radiusKm = radiusStr != null ? parseFloat(radiusStr) : RECOMMENDATION_DEFAULT_RADIUS_KM;
    if (!validateRadius(radiusKm)) {
      return errorResponse(ERROR_MESSAGES.INVALID_INPUT, 400);
    }

    const user = await getServerUser(request);

    const result = await getRecommendations(
      {
        userId: user?.id ?? null,
        latitude,
        longitude,
        radiusKm,
        page,
        limit,
      },
      RECOMMENDATION_CACHE_TTL_SECONDS
    );

    const response = successResponse(result);
    setCacheHeaders(
      response,
      RECOMMENDATION_CACHE_TTL_SECONDS,
      RECOMMENDATION_CACHE_TTL_SECONDS * 2
    );
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
