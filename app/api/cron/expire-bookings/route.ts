import { NextRequest } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES } from '@/config/constants';
import { validateCronSecret } from '@/lib/security/cron-auth';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Validate cron secret
    const authError = validateCronSecret(request);
    if (authError) {
      return authError;
    }

    await bookingService.expireOldBookings();

    return successResponse(null, 'Expired bookings processed successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

