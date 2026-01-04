import { NextRequest } from 'next/server';
import { slotService } from '@/services/slot.service';
import { salonService } from '@/services/salon.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES, SUCCESS_MESSAGES } from '@/config/constants';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const salonId = searchParams.get('salon_id');
    const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

    if (!salonId) {
      return errorResponse('Salon ID is required', 400);
    }

    // Fetch salon config for lazy generation
    const salon = await salonService.getSalonById(salonId);
    if (!salon) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    // Get slots with lazy generation (will generate if missing)
    const slots = await slotService.getAvailableSlots(salonId, date, {
      opening_time: salon.opening_time,
      closing_time: salon.closing_time,
      slot_duration: salon.slot_duration,
    });

    return successResponse(slots);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { salon_id, date } = body;

    if (!salon_id || !date) {
      return errorResponse('Salon ID and date are required', 400);
    }

    const salon = await salonService.getSalonById(salon_id);

    if (!salon) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    await slotService.generateSlotsForDate(salon_id, date, {
      opening_time: salon.opening_time,
      closing_time: salon.closing_time,
      slot_duration: salon.slot_duration,
    });

    return successResponse(null, SUCCESS_MESSAGES.SLOTS_GENERATED);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

