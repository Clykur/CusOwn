/**
 * Edge Runtime–compatible utilities.
 *
 * Functions here must NOT import Node.js-only modules (e.g. 'crypto')
 * so they can be safely used inside Next.js middleware (Edge Runtime).
 */

import type { NextRequest } from 'next/server';

/** Get client IP from request (Next 14/15 compatible; ip may be untyped in Next 15). */
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
