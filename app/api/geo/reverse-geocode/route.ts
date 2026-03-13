/**
 * GET /api/geo/reverse-geocode
 * Reverse-geocode coordinates to city/region/country using BigDataCloud free API (no key).
 * Rate-limited per IP; cached.
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { geolocationService } from '@/lib/services/geolocation.service';
import {
  ERROR_MESSAGES,
  GEO_RATE_LIMIT_WINDOW_MS,
  GEO_RATE_LIMIT_MAX_PER_WINDOW,
  GEO_CACHE_MAX_AGE_SECONDS,
} from '@/config/constants';
import { validateCoordinates } from '@/lib/utils/geo';
import {
  buildApiRedisKeyFromPath,
  getApiRedisCache,
  setApiRedisCache,
  API_REDIS_TTL,
} from '@/lib/cache/api-redis-cache';

const geoRateLimit = enhancedRateLimit({
  maxRequests: GEO_RATE_LIMIT_MAX_PER_WINDOW,
  windowMs: GEO_RATE_LIMIT_WINDOW_MS,
  perIP: true,
  keyPrefix: 'geo_reverse',
});

export async function GET(request: NextRequest) {
  const rateLimitResponse = await geoRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const url = new URL(request.url);
  const latParam = url.searchParams.get('latitude');
  const lngParam = url.searchParams.get('longitude');
  const localityLanguage = url.searchParams.get('localityLanguage') ?? undefined;

  if (latParam === null || lngParam === null) {
    return errorResponse(ERROR_MESSAGES.GEO_INVALID_COORDINATES, 400);
  }

  const latitude = Number(latParam);
  const longitude = Number(lngParam);

  if (
    Number.isNaN(latitude) ||
    Number.isNaN(longitude) ||
    !validateCoordinates(latitude, longitude)
  ) {
    return errorResponse(ERROR_MESSAGES.GEO_INVALID_COORDINATES, 400);
  }

  // Check Redis cache first (reverse geocode results are highly cacheable)
  const redisKey = buildApiRedisKeyFromPath('/api/geo/reverse-geocode', {
    latitude: latitude.toFixed(6),
    longitude: longitude.toFixed(6),
  });
  const redisCached = await getApiRedisCache<{
    city: string;
    region: string;
    countryCode: string;
    countryName: string;
    latitude: number;
    longitude: number;
    address_line1?: string;
    postal_code?: string;
  }>(redisKey);
  if (redisCached) {
    const response = successResponse(redisCached);
    setCacheHeaders(response, GEO_CACHE_MAX_AGE_SECONDS, GEO_CACHE_MAX_AGE_SECONDS * 2);
    return response;
  }

  const data = await geolocationService.reverseGeocode(latitude, longitude);
  if (!data) {
    return errorResponse(ERROR_MESSAGES.GEO_SERVICE_UNAVAILABLE, 503);
  }

  const responseData = {
    city: data.city || data.locality,
    region: data.state || data.principalSubdivision,
    countryCode: data.countryCode,
    countryName: data.country,
    latitude: data.latitude,
    longitude: data.longitude,
    address_line1: data.address_line1,
    postal_code: data.postal_code,
  };

  // Cache in Redis (geo data changes rarely)
  await setApiRedisCache(redisKey, responseData, API_REDIS_TTL.GEO);

  const response = successResponse(responseData);
  setCacheHeaders(response, GEO_CACHE_MAX_AGE_SECONDS, GEO_CACHE_MAX_AGE_SECONDS * 2);
  return response;
}
