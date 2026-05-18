import { NextRequest } from 'next/server';
import { successMetricsService } from '@cusown/shared/server';
import { alertingService } from '@cusown/shared/server';
import { successResponse, errorResponse } from '@cusown/shared/server';
import { getServerUser } from '@cusown/shared/server';
import { checkIsAdminServer } from '@cusown/shared/server';
import { setCacheHeaders } from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const isAdmin = await checkIsAdminServer(user.id);
    if (!isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    const { searchParams } = new URL(request.url);
    const startDate =
      searchParams.get('start_date') ||
      new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];
    const includeAlerts = searchParams.get('include_alerts') === 'true';

    const metrics = await successMetricsService.getSuccessMetrics(startDate, endDate);
    const thresholds = await successMetricsService.checkThresholds(metrics);

    let alerts: any[] = [];
    if (includeAlerts) {
      alerts = await alertingService.checkAlerts(metrics);
      void Promise.all(alerts.map((a) => alertingService.recordAlert(a))).catch(() => {});
    }

    const response = successResponse({
      metrics,
      thresholds,
      alerts: includeAlerts ? alerts : undefined,
    });
    setCacheHeaders(response, 60, 120);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
