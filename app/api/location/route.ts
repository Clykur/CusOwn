/**
 * GET /api/location
 * Returns current user location from cookie or DB (fresh < 7 days). If missing, falls back to BigDataCloud IP once and sets cookie.
 * Never calls BigDataCloud on every request.
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { getServerUser } from '@/lib/supabase/server-auth';
import { getLocation } from '@/lib/geo/service';
import {
  ERROR_MESSAGES,
  GEO_RATE_LIMIT_WINDOW_MS,
  GEO_RATE_LIMIT_MAX_PER_WINDOW,
} from '@/config/constants';

const locationRateLimit = enhancedRateLimit({
  maxRequests: GEO_RATE_LIMIT_MAX_PER_WINDOW,
  windowMs: GEO_RATE_LIMIT_WINDOW_MS,
  perIP: true,
  keyPrefix: 'location_get',
});

export async function GET(request: NextRequest) {
  const rateLimitResponse = await locationRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  try {
    const user = await getServerUser(request);
    const { location, setCookieHeader } = await getLocation(request, user?.id ?? null);

    const response = location
      ? successResponse({ location })
      : successResponse({ location: null }, undefined);

    if (setCookieHeader) {
      response.headers.set('Set-Cookie', setCookieHeader);
    }
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.GEO_SERVICE_UNAVAILABLE;
    return errorResponse(message, 503);
  }
}
