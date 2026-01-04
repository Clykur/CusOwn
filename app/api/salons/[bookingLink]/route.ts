import { NextRequest } from 'next/server';
import { salonService } from '@/services/salon.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { ERROR_MESSAGES } from '@/config/constants';

export async function GET(
  request: NextRequest,
  { params }: { params: { bookingLink: string } }
) {
  try {
    const { bookingLink } = params;

    if (!bookingLink) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    // Check if it's a UUID (salon ID) or a booking link (slug)
    const isUUID = isValidUUID(bookingLink);

    let salon;
    if (isUUID) {
      salon = await salonService.getSalonById(bookingLink);
    } else {
      salon = await salonService.getSalonByBookingLink(bookingLink);
    }

    if (!salon) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    return successResponse(salon);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

