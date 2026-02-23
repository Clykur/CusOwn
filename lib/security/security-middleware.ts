import { NextRequest, NextResponse } from 'next/server';
import { sanitizeRequestBody } from './input-sanitizer';
import { csrfProtection } from './csrf';
import { tokenBucketRateLimit } from './token-bucket-rate-limit.security';

export const securityMiddleware = async (request: NextRequest): Promise<NextResponse | null> => {
  if (!request.nextUrl.pathname.startsWith('/api/')) {
    return null;
  }

  const tokenBucketResponse = await tokenBucketRateLimit(request);
  if (tokenBucketResponse) {
    return tokenBucketResponse;
  }

  // Exempt: read-only URL generation; webhooks (signature-verified); cron (CRON_SECRET);
  // public booking (no session when user lands from QR, so no CSRF cookie yet).
  const isExemptFromCsrf =
    request.nextUrl.pathname === '/api/security/generate-salon-url' ||
    request.nextUrl.pathname === '/api/security/generate-resource-url' ||
    request.nextUrl.pathname.startsWith('/api/payments/webhook/') ||
    request.nextUrl.pathname.startsWith('/api/cron/') ||
    request.nextUrl.pathname === '/api/book/set-pending' ||
    request.nextUrl.pathname === '/api/bookings';

  if (!isExemptFromCsrf) {
    const csrfResponse = await csrfProtection(request);
    if (csrfResponse) {
      return csrfResponse;
    }
  }

  return null;
};

export const sanitizeRequest = async (request: NextRequest): Promise<any> => {
  if (request.method === 'GET' || request.method === 'HEAD') {
    return null;
  }

  try {
    const body = await sanitizeRequestBody(request);
    return body;
  } catch {
    return null;
  }
};
