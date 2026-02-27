/**
 * GET /api/geo/reverse-geocode
 * Reverse-geocode coordinates to city/region/country using BigDataCloud free API (no key).
 * Rate-limited per IP; cached.
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { reverseGeocode } from '@/lib/geo/bigdatacloud';
import {
  ERROR_MESSAGES,
  GEO_RATE_LIMIT_WINDOW_MS,
  GEO_RATE_LIMIT_MAX_PER_WINDOW,
  GEO_CACHE_MAX_AGE_SECONDS,
} from '@/config/constants';
import { validateCoordinates } from '@/lib/utils/geo';

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

  const data = await reverseGeocode(latitude, longitude, { localityLanguage });
  if (!data) {
    return errorResponse(ERROR_MESSAGES.GEO_SERVICE_UNAVAILABLE, 503);
  }

  const response = successResponse({
    city: data.city ?? data.locality,
    region: data.principalSubdivision,
    countryCode: data.countryCode,
    countryName: data.countryName,
    localityInfo: data.localityInfo,
    latitude: data.latitude,
    longitude: data.longitude,
  });
  setCacheHeaders(response, GEO_CACHE_MAX_AGE_SECONDS, GEO_CACHE_MAX_AGE_SECONDS * 2);
  return response;
}
