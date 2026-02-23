import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { parseAdminDateRange } from '@/lib/utils/date-range-admin';
import { adminAnalyticsService } from '@/services/admin-analytics.service';
import { ADMIN_BUSINESS_HEALTH_DEFAULT_LIMIT, ERROR_MESSAGES } from '@/config/constants';

const ROUTE = 'GET /api/admin/business-health';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const searchParams = request.nextUrl.searchParams;
    const limitParam = searchParams.get('limit');
    const limit = limitParam
      ? Math.min(100, Math.max(1, parseInt(limitParam, 10) || ADMIN_BUSINESS_HEALTH_DEFAULT_LIMIT))
      : ADMIN_BUSINESS_HEALTH_DEFAULT_LIMIT;

    const range = parseAdminDateRange(searchParams);
    const data = await adminAnalyticsService.getBusinessHealth(range, limit);
    return successResponse(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
