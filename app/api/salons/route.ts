import { NextRequest } from 'next/server';
import { salonService } from '@/services/salon.service';
import { validateCreateSalon, validateTimeRange } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getBookingUrl } from '@/lib/utils/url';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/config/constants';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = validateCreateSalon(body);

    validateTimeRange(validatedData.opening_time, validatedData.closing_time);

    const salon = await salonService.createSalon(validatedData);

    return successResponse(
      {
        ...salon,
        booking_url: getBookingUrl(salon.booking_link),
      },
      SUCCESS_MESSAGES.SALON_CREATED
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 400);
  }
}

