/**
 * Centralized cron job authentication
 * Validates CRON_SECRET for all background jobs
 */

import { NextRequest, NextResponse } from 'next/server';
import { env } from '@/config/env';
import { getClientIp } from '@/lib/utils/security';
import { errorResponse } from '@/lib/utils/response';

export const validateCronSecret = (request: NextRequest): NextResponse | null => {
  const authHeader = request.headers.get('authorization');
  const expectedSecret = env.cron.secret;

  // If secret is not configured, allow in development only
  if (!expectedSecret) {
    if (process.env.NODE_ENV === 'production') {
      console.error('[SECURITY] CRON_SECRET not configured in production');
      return errorResponse('Cron authentication not configured', 500);
    }
    // Development: allow without secret (not recommended)
    return null;
  }

  // Validate Bearer token
  if (!authHeader || authHeader !== `Bearer ${expectedSecret}`) {
    const clientIP = getClientIp(request);
    console.warn(`[SECURITY] Invalid cron secret from IP: ${clientIP}`);
    return errorResponse('Unauthorized', 401);
  }

  return null;
};
