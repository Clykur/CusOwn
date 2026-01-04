import { NextRequest } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { whatsappService } from '@/services/whatsapp.service';
import { salonService } from '@/services/salon.service';
import { slotService } from '@/services/slot.service';
import { validateCreateBooking } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { SUCCESS_MESSAGES, ERROR_MESSAGES, SLOT_STATUS } from '@/config/constants';
import { BookingWithDetails } from '@/types';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validatedData = validateCreateBooking(body);

    if (!isValidUUID(validatedData.salon_id) || !isValidUUID(validatedData.slot_id)) {
      return errorResponse('Invalid salon or slot ID', 400);
    }

    // Check slot availability first
    const slot = await slotService.getSlotById(validatedData.slot_id);
    if (!slot) {
      return errorResponse(ERROR_MESSAGES.SLOT_NOT_FOUND, 404);
    }

    // Check if slot is available (not booked, and not reserved with valid expiration)
    if (slot.status === SLOT_STATUS.BOOKED) {
      return errorResponse(ERROR_MESSAGES.SLOT_NOT_AVAILABLE, 409);
    }

    if (slot.status === SLOT_STATUS.RESERVED && slot.reserved_until) {
      const reservedUntil = new Date(slot.reserved_until);
      if (reservedUntil > new Date()) {
        // Still reserved and not expired
        return errorResponse(ERROR_MESSAGES.SLOT_NOT_AVAILABLE, 409);
      }
      // Reservation expired, release it first
      await slotService.releaseSlot(validatedData.slot_id);
    }

    // Try to reserve the slot
    let reservationSuccess = false;
    try {
      reservationSuccess = await slotService.reserveSlot(validatedData.slot_id);
    } catch (reserveError) {
      // If reservation fails, slot was taken between check and reserve
      return errorResponse(ERROR_MESSAGES.SLOT_NOT_AVAILABLE, 409);
    }

    if (!reservationSuccess) {
      return errorResponse(ERROR_MESSAGES.SLOT_NOT_AVAILABLE, 409);
    }

    let booking;
    try {
      booking = await bookingService.createBooking(validatedData);
    } catch (bookingError) {
      // If booking creation fails, release the reservation
      try {
        await slotService.releaseSlot(validatedData.slot_id);
      } catch (releaseError) {
        // Ignore release errors
      }
      throw bookingError;
    }
    const salon = await salonService.getSalonById(validatedData.salon_id);

    if (!salon) {
      throw new Error(ERROR_MESSAGES.SALON_NOT_FOUND);
    }

    // Re-fetch slot to get updated status after reservation
    const updatedSlot = await slotService.getSlotById(validatedData.slot_id);

    if (!updatedSlot) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_FOUND);
    }

    if (updatedSlot.salon_id !== validatedData.salon_id) {
      throw new Error('Slot does not belong to this salon');
    }

    const bookingWithDetails: BookingWithDetails = {
      ...booking,
      salon,
      slot: updatedSlot,
    };

    const { message, whatsappUrl } = whatsappService.generateBookingRequestMessage(
      bookingWithDetails,
      salon
    );

    return successResponse(
      {
        booking,
        whatsapp_url: whatsappUrl,
        message,
      },
      SUCCESS_MESSAGES.BOOKING_CREATED
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 400);
  }
}

