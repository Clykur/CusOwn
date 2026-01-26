import { NextRequest, NextResponse } from 'next/server';
import { notificationService } from '@/services/notification.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { setCacheHeaders } from '@/lib/cache/next-cache';
import { ERROR_MESSAGES } from '@/config/constants';

export async function GET(
  request: NextRequest,
  { params }: { params: { bookingId: string } }
) {
  try {
    const { bookingId } = params;
    if (!bookingId || !isValidUUID(bookingId)) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const history = await notificationService.getNotificationHistory(bookingId);

    const response = successResponse(history);
    setCacheHeaders(response, 60, 120);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
