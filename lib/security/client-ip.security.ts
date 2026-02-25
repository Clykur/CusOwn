import type { NextRequest } from 'next/server';

/** Edge-safe client IP extraction for middleware/rate limiting. */
export const getClientIp = (request: NextRequest | undefined): string => {
  if (!request) return 'unknown';
  const req = request as NextRequest & { ip?: string };
  if (req.ip) return req.ip;

  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();

  const real = request.headers.get('x-real-ip');
  if (real) return real;

  return 'unknown';
};
