/**
 * GET /api/admin/dashboard
 * Unified admin dashboard API with Redis aggregation caching.
 * Returns all dashboard data in a single optimized request.
 */

import { NextRequest } from 'next/server';
import {
  successResponse,
  errorResponse,
  setCacheHeaders,
  dashboardService,
  adminRateLimit,
  getServerUser,
  getServerUserProfile,
  isAdminProfile,
} from '@cusown/shared/server';

export async function GET(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await adminRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    // Auth check - admin only
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    // Note: profile fetch depends on user.id, so it cannot be parallelized with user fetch
    const profile = await getServerUserProfile(user.id);
    if (!profile || !isAdminProfile(profile)) {
      return errorResponse('Admin access required', 403);
    }

    // Get aggregated dashboard data (cached)
    const dashboardData = await dashboardService.getAdminDashboard();

    const response = successResponse(dashboardData);
    setCacheHeaders(response, 30, 60);
    return response;
  } catch (error) {
    console.error('[API:ADMIN_DASHBOARD] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to fetch dashboard';
    return errorResponse(message, 500);
  }
}
