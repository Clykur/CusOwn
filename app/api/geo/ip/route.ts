/**
 * GET /api/geo/ip
 * Get geolocation for client IP (or optional ?ip= query) using BigDataCloud free API (no key).
 * Rate-limited per IP; cached. Use for city/region/country from IP.
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { geolocationService } from '@/lib/services/geolocation.service';
import { getClientIp } from '@/lib/utils/security';
import {
  ERROR_MESSAGES,
  GEO_RATE_LIMIT_WINDOW_MS,
  GEO_RATE_LIMIT_MAX_PER_WINDOW,
  GEO_CACHE_MAX_AGE_SECONDS,
} from '@/config/constants';

const geoRateLimit = enhancedRateLimit({
  maxRequests: GEO_RATE_LIMIT_MAX_PER_WINDOW,
  windowMs: GEO_RATE_LIMIT_WINDOW_MS,
  perIP: true,
  keyPrefix: 'geo_ip',
});

/** Basic IPv4/IPv6 validation to avoid passing arbitrary strings to upstream. */
function isValidIp(ip: string): boolean {
  if (!ip || ip.length > 45) return false;
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  if (ipv4.test(ip)) {
    return ip.split('.').every((n) => parseInt(n, 10) >= 0 && parseInt(n, 10) <= 255);
  }
  return ipv6.test(ip) || ip === '::1';
}

export async function GET(request: NextRequest) {
  const rateLimitResponse = await geoRateLimit(request);
  if (rateLimitResponse) return rateLimitResponse;

  const url = new URL(request.url);
  const ipParam = url.searchParams.get('ip');
  const clientIp = getClientIp(request);

  const ip = ipParam?.trim();
  if (ip !== undefined && ip !== '' && !isValidIp(ip)) {
    return errorResponse('Invalid IP parameter', 400);
  }

  const ipToLookup = ip && ip !== '' ? ip : clientIp;

  // Handle local development / private IPs
  const isLocal =
    ipToLookup === '::1' ||
    ipToLookup === '127.0.0.1' ||
    ipToLookup.startsWith('192.168.') ||
    ipToLookup.startsWith('10.');

  let data = await geolocationService.ipLookup(ipToLookup);

  // If local and lookup failed or returned 0,0, provide a default for dev testing
  if (isLocal && (!data || (data.latitude === 0 && data.longitude === 0))) {
    data = {
      ip: ipToLookup,
      latitude: 12.9716, // Bangalore (default dev location)
      longitude: 77.5946,
      city: 'Bangalore',
      country: 'India',
      countryCode: 'IN',
      state: 'Karnataka',
    };
  }

  if (!data) {
    return errorResponse(ERROR_MESSAGES.GEO_SERVICE_UNAVAILABLE, 503);
  }

  const response = successResponse({
    ip: data.ip || clientIp,
    city: data.city,
    region: data.state,
    countryCode: data.countryCode,
    countryName: data.country,
    latitude: data.latitude,
    longitude: data.longitude,
  });
  setCacheHeaders(response, Math.min(GEO_CACHE_MAX_AGE_SECONDS, 3600), 7200);
  return response;
}
