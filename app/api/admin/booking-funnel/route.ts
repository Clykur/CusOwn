import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { parseAdminDateRange } from '@/lib/utils/date-range-admin';
import { adminAnalyticsService } from '@/services/admin-analytics.service';
import { auditService } from '@/services/audit.service';
import { ERROR_MESSAGES } from '@/config/constants';

const ROUTE = 'GET /api/admin/booking-funnel';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const range = parseAdminDateRange(request.nextUrl.searchParams);
    const data = await adminAnalyticsService.getBookingFunnel(range);
    void auditService
      .createAuditLog(auth.user.id, 'admin_funnel_analytics_view', 'system', {
        description: `Funnel analytics viewed: ${range.startDate.toISOString()} to ${range.endDate.toISOString()}`,
        request,
      })
      .catch(() => {});
    return successResponse(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
