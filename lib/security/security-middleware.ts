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

  // Exempt URL generation endpoints from CSRF (read-only operations)
  // Still protected by rate limiting and authorization
  const isUrlGenerationEndpoint =
    request.nextUrl.pathname === '/api/security/generate-salon-url' ||
    request.nextUrl.pathname === '/api/security/generate-resource-url';

  if (!isUrlGenerationEndpoint) {
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
