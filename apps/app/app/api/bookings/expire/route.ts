import { NextRequest } from 'next/server';
import { bookingService } from '@cusown/shared/server';
import { successResponse, errorResponse } from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';
import { validateCronSecret } from '@cusown/shared/server';

/**
 * Expire pending bookings older than BOOKING_EXPIRY_HOURS.
 * SECURITY: Cron-only; requires CRON_SECRET (same as /api/cron/expire-bookings).
 * Use /api/cron/expire-bookings for scheduled runs; this route allows manual/cron trigger with same auth.
 */
export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) {
      return authError;
    }

    await bookingService.expireOldBookings({ source: 'cron' });
    return successResponse(null, 'Expired bookings processed successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
