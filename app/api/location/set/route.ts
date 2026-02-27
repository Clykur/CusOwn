/**
 * POST /api/location/set
 * Persist location from client (e.g. after navigator.geolocation). Body: latitude, longitude, optional city, region, country_code, source.
 * If only lat/lon provided, reverse-geocodes once (BigDataCloud) to fill city/region/country, then stores in DB + cookie.
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { validateCSRFToken } from '@/lib/security/csrf';
import { getServerUser } from '@/lib/supabase/server-auth';
import { setLocation } from '@/lib/geo/service';
import { reverseGeocode } from '@/lib/geo/provider';
import { validateCoordinates } from '@/lib/utils/geo';
import {
  ERROR_MESSAGES,
  GEO_RATE_LIMIT_WINDOW_MS,
  GEO_RATE_LIMIT_MAX_PER_WINDOW,
} from '@/config/constants';

const locationRateLimit = enhancedRateLimit({
  maxRequests: GEO_RATE_LIMIT_MAX_PER_WINDOW,
  windowMs: GEO_RATE_LIMIT_WINDOW_MS,
  perIP: true,
  keyPrefix: 'location_set',
});

export async function POST(request: NextRequest) {
  const rateLimitResponse = await locationRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const csrfValid = await validateCSRFToken(request);
  if (!csrfValid) return errorResponse('Invalid CSRF token', 403);

  try {
    const body = await request.json().catch(() => ({}));
    const lat = typeof body.latitude === 'number' ? body.latitude : Number(body.latitude);
    const lon = typeof body.longitude === 'number' ? body.longitude : Number(body.longitude);
    const source = body.source === 'ip' ? 'ip' : 'gps';

    if (Number.isNaN(lat) || Number.isNaN(lon) || !validateCoordinates(lat, lon)) {
      return errorResponse(ERROR_MESSAGES.GEO_INVALID_COORDINATES, 400);
    }

    let city: string | undefined = body.city;
    let region: string | undefined = body.region;
    let country_code: string | undefined = body.country_code;

    if ((!city && !region && !country_code) || source === 'gps') {
      const resolved = await reverseGeocode(lat, lon);
      if (resolved) {
        city = resolved.city ?? city;
        region = resolved.region ?? region;
        country_code = resolved.countryCode ?? country_code;
      }
    }

    const user = await getServerUser(request);
    const { setCookieHeader } = await setLocation(
      request,
      {
        latitude: lat,
        longitude: lon,
        city,
        region,
        country_code,
        source,
      },
      user?.id ?? null
    );

    const response = successResponse({
      location: {
        latitude: lat,
        longitude: lon,
        city,
        region,
        country_code,
        source,
      },
    });
    response.headers.set('Set-Cookie', setCookieHeader);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.LOCATION_INVALID;
    return errorResponse(message, 400);
  }
}
