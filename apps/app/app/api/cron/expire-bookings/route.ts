import { NextRequest } from 'next/server';
import { bookingService } from '@cusown/shared/server';
import { successResponse, errorResponse } from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';
import { validateCronSecret } from '@cusown/shared/server';
import { safeMetrics } from '@cusown/shared/server';
import {
  METRICS_CRON_EXPIRE_BOOKINGS_LAST_RUN,
  METRICS_OBSERVABILITY_CRON_HEALTH_STATUS,
} from '@cusown/config';
import { withCronRunLog } from '@cusown/shared/server';

export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) return authError;

    return await withCronRunLog('expire-bookings', async () => {
      await bookingService.expireOldBookings({ source: 'cron' });
      safeMetrics.setGauge(METRICS_CRON_EXPIRE_BOOKINGS_LAST_RUN, Math.floor(Date.now() / 1000));
      safeMetrics.setGauge(METRICS_OBSERVABILITY_CRON_HEALTH_STATUS, 1);
      return successResponse(null, 'Expired bookings processed successfully');
    });
  } catch (error) {
    safeMetrics.setGauge(METRICS_OBSERVABILITY_CRON_HEALTH_STATUS, 0);
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
