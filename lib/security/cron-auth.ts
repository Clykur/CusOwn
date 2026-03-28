/**
 * Centralized cron job authentication.
 * Production: CRON_SECRET is required at app startup (config/env); requests must send Authorization: Bearer <CRON_SECRET>.
 */

import { timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { ERROR_MESSAGES } from '@/config/constants';
import { env } from '@/config/env';
import { getClientIp } from '@/lib/utils/security';
import { errorResponse } from '@/lib/utils/response';

function cronRequestPath(request: NextRequest): string {
  try {
    return request.nextUrl?.pathname ?? new URL(request.url).pathname;
  } catch {
    return '(unknown)';
  }
}

/** Constant-time comparison for Bearer token vs configured secret. */
function cronBearerMatches(expected: string, authHeader: string | null): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7);
  if (token.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(token, 'utf8'), Buffer.from(expected, 'utf8'));
  } catch {
    return false;
  }
}

/**
 * Validates CRON_SECRET for cron HTTP handlers.
 * @returns null if authorized; otherwise a NextResponse to return (401/500).
 * In production, missing CRON_SECRET should be caught when @/config/env loads; this path is fail-closed.
 */
export const validateCronSecret = (request: NextRequest): NextResponse | null => {
  const expectedSecret = env.cron.secret?.trim() ?? '';
  const path = cronRequestPath(request);
  const clientIp = getClientIp(request);
  const authHeader = request.headers.get('authorization');

  if (!expectedSecret) {
    if (env.nodeEnv === 'production') {
      console.error(
        `[SECURITY] Cron auth misconfiguration: CRON_SECRET is empty but validateCronSecret ran (path=${path} ip=${clientIp}). Production should fail startup if CRON_SECRET is unset.`
      );
      return errorResponse(ERROR_MESSAGES.CRON_AUTH_NOT_CONFIGURED, 500);
    }
    return null;
  }

  if (!authHeader) {
    console.error(
      `[SECURITY] Unauthorized cron access: missing Authorization header path=${path} ip=${clientIp}`
    );
    return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401);
  }

  if (!authHeader.startsWith('Bearer ')) {
    console.error(
      `[SECURITY] Unauthorized cron access: Authorization must be Bearer token path=${path} ip=${clientIp}`
    );
    return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401);
  }

  if (!cronBearerMatches(expectedSecret, authHeader)) {
    console.error(
      `[SECURITY] Unauthorized cron access: invalid CRON_SECRET path=${path} ip=${clientIp}`
    );
    return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401);
  }

  return null;
};
