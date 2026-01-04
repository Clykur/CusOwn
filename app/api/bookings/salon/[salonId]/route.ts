import { NextRequest } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { ERROR_MESSAGES } from '@/config/constants';

export async function GET(
  request: NextRequest,
  { params }: { params: { salonId: string } }
) {
  try {
    const { salonId } = params;
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date') || undefined;

    if (!salonId || !isValidUUID(salonId)) {
      return errorResponse('Invalid salon ID', 400);
    }

    const bookings = await bookingService.getSalonBookings(salonId, date);

    return successResponse(bookings);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

