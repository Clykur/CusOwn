import { BOOKING_LINK_PREFIX } from '@/config/constants';
import { env } from '@/config/env';
import { NextRequest } from 'next/server';

/**
 * Get the base URL from request headers (production) or environment variable
 */
export const getBaseUrl = (request?: NextRequest): string => {
  // If request is provided, use the origin from Next.js URL (works in production)
  if (request) {
    // request.nextUrl.origin automatically includes protocol and host
    // This works correctly in both development and production
    const origin = request.nextUrl.origin;
    
    if (origin && origin !== 'http://localhost:3000') {
      return origin;
    }
    
    // Also check host header as fallback
    const host = request.headers.get('host');
    if (host && !host.includes('localhost')) {
      // For production, use https
      return `https://${host}`;
    }
  }

  // Fallback to environment variable or localhost
  return env.app.baseUrl;
};

export const getBookingUrl = (bookingLink: string, request?: NextRequest): string => {
  const baseUrl = getBaseUrl(request);
  return `${baseUrl}${BOOKING_LINK_PREFIX}${bookingLink}`;
};

export const getApiUrl = (path: string, request?: NextRequest): string => {
  const baseUrl = getBaseUrl(request);
  return `${baseUrl}${path}`;
};

