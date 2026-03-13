/**
 * GET /api/owner/dashboard
 * Unified owner dashboard API with Redis aggregation caching.
 * Returns all dashboard data in a single optimized request.
 */

import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { requireOwner } from '@/lib/utils/api-auth-pipeline';
import { dashboardService } from '@/services/dashboard.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';

const ROUTE = 'GET /api/owner/dashboard';

const dashboardRateLimit = enhancedRateLimit({
  maxRequests: 60,
  windowMs: 60000,
  perIP: true,
  perUser: true,
  keyPrefix: 'owner_dashboard',
});

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await dashboardRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Auth check
    const auth = await requireOwner(request, ROUTE);
    if (auth instanceof Response) return auth;

    // Parse query params
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    // Get aggregated dashboard data (cached)
    const dashboardData = await dashboardService.getOwnerDashboard(auth.user.id, {
      fromDate,
      toDate,
    });

    const response = successResponse(dashboardData);
    setCacheHeaders(response, 30, 60);
    return response;
  } catch (error) {
    console.error('[API:OWNER_DASHBOARD] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard';
    return errorResponse(message, 500);
  }
}
