/**
 * GET /api/health/media — media subsystem health (storage + media table).
 * For load balancers and monitoring; no auth.
 */

import { NextRequest } from 'next/server';
import { checkMediaHealth } from '@/lib/monitoring/health';
import { successResponse, errorResponse } from '@/lib/utils/response';

export async function GET(request: NextRequest) {
  try {
    const health = await checkMediaHealth();
    if (health.status === 'unhealthy') {
      return successResponse(health, undefined);
    }
    return successResponse(health);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Media health check failed';
    return errorResponse(message, 500);
  }
}
