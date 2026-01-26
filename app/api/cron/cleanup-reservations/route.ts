import { NextRequest } from 'next/server';
import { slotService } from '@/services/slot.service';
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

    const releasedCount = await slotService.releaseExpiredReservations();

    return successResponse(
      { released_count: releasedCount },
      `Released ${releasedCount} expired reservations`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

