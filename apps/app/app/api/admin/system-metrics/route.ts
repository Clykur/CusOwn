import { NextRequest } from 'next/server';
import { requireAdmin, successResponse, errorResponse, adminAnalyticsService } from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';

const ROUTE = 'GET /api/admin/system-metrics';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAdmin(request, ROUTE);
    if (auth instanceof Response) return auth;

    const data = await adminAnalyticsService.getSystemMetrics();
    return successResponse(data);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
