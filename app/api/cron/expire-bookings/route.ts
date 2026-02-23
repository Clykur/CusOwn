import { NextRequest } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { validateCronSecret } from '@/lib/security/cron-auth';
import { metricsService } from '@/lib/monitoring/metrics';
import { METRICS_CRON_EXPIRE_BOOKINGS_LAST_RUN } from '@/config/constants';
import { withCronRunLog } from '@/services/cron-run.service';

export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) return authError;

    return await withCronRunLog('expire-bookings', async () => {
      await bookingService.expireOldBookings({ source: 'cron' });
      await metricsService.setGauge(
        METRICS_CRON_EXPIRE_BOOKINGS_LAST_RUN,
        Math.floor(Date.now() / 1000)
      );
      return successResponse(null, 'Expired bookings processed successfully');
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
