import { NextRequest } from 'next/server';
import {
  slotService,
  successResponse,
  errorResponse,
  validateCronSecret,
  withCronRunLog,
} from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';

export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) return authError;

    return await withCronRunLog('cleanup-reservations', async () => {
      const releasedCount = await slotService.releaseExpiredReservations();
      return successResponse(
        { released_count: releasedCount },
        `Released ${releasedCount} expired reservations`
      );
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
