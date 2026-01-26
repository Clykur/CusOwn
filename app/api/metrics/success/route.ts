import { NextRequest, NextResponse } from 'next/server';
import { successMetricsService } from '@/lib/monitoring/success-metrics';
import { alertingService } from '@/lib/monitoring/alerting';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getServerUser } from '@/lib/supabase/server-auth';
import { checkIsAdminServer } from '@/lib/utils/admin';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { ERROR_MESSAGES } from '@/config/constants';

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
    const startDate = searchParams.get('start_date') || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = searchParams.get('end_date') || new Date().toISOString().split('T')[0];
    const includeAlerts = searchParams.get('include_alerts') === 'true';

    const metrics = await successMetricsService.getSuccessMetrics(startDate, endDate);
    const thresholds = await successMetricsService.checkThresholds(metrics);

    let alerts: any[] = [];
    if (includeAlerts) {
      alerts = await alertingService.checkAlerts(metrics);
      for (const alert of alerts) {
        await alertingService.recordAlert(alert);
      }
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
