import { supabaseAdmin } from '@/lib/supabase/server';
import { slotService } from './slot.service';
import { bookingService } from './booking.service';
import { ERROR_MESSAGES, BOOKING_STATUS, SLOT_STATUS } from '@/config/constants';

export interface RescheduleInput {
  bookingId: string;
  newSlotId: string;
  rescheduledBy: 'customer' | 'owner';
  reason?: string;
}

export class RescheduleService {
  async rescheduleBooking(input: RescheduleInput): Promise<any> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const booking = await bookingService.getBookingByUuidWithDetails(input.bookingId);
    if (!booking) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    if (booking.status !== BOOKING_STATUS.CONFIRMED && booking.status !== BOOKING_STATUS.PENDING) {
      throw new Error('Only confirmed or pending bookings can be rescheduled');
    }

    if (booking.no_show) {
      throw new Error('No-show bookings cannot be rescheduled');
    }

    const newSlot = await slotService.getSlotById(input.newSlotId);
    if (!newSlot) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_FOUND);
    }

    if (newSlot.business_id !== booking.business_id) {
      throw new Error('New slot must belong to the same business');
    }

    if (newSlot.id === booking.slot_id) {
      throw new Error('New slot must be different from current slot');
    }

    if (newSlot.status !== SLOT_STATUS.AVAILABLE) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_AVAILABLE);
    }

    const oldSlotId = booking.slot_id;

    // 1️⃣ Reserve new slot
    const reserved = await slotService.reserveSlot(input.newSlotId);
    if (!reserved) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_AVAILABLE);
    }
    // 2️⃣ Book new slot (RESERVED → BOOKED)
    await slotService.markSlotAsBooked(input.newSlotId);

    // 3️⃣ Update booking
    const { data: updatedBooking, error } = await supabaseAdmin
      .from('bookings')
      .update({
        slot_id: input.newSlotId,
        rescheduled_from_booking_id: booking.id,
        rescheduled_at: new Date().toISOString(),
        rescheduled_by: input.rescheduledBy,
        reschedule_reason: input.reason || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', input.bookingId)
      .select()
      .single();

    if (error) {
      // rollback new slot if booking update fails
      await slotService.releaseSlot(input.newSlotId);
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    // 4️⃣ Release old slot
    if (oldSlotId) {
      await slotService.releaseSlot(oldSlotId);
    }

    return updatedBooking;
  }

  async getRescheduleHistory(bookingId: string): Promise<any[]> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const booking = await bookingService.getBookingByUuidWithDetails(bookingId);
    if (!booking) {
      return [];
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, rescheduled_at, rescheduled_by, reschedule_reason, slot_id')
      .eq('rescheduled_from_booking_id', booking.id)
      .order('rescheduled_at', { ascending: false });

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data || [];
  }

  async checkAvailabilityForReschedule(
    businessId: string,
    currentSlotId: string,
    targetDate: string,
    targetTime: string
  ): Promise<boolean> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const currentSlot = await slotService.getSlotById(currentSlotId);
    if (!currentSlot || currentSlot.business_id !== businessId) {
      return false;
    }

    const { data: slots, error } = await supabaseAdmin
      .from('slots')
      .select('id, status')
      .eq('business_id', businessId)
      .eq('date', targetDate)
      .eq('start_time', targetTime)
      .eq('status', SLOT_STATUS.AVAILABLE)
      .limit(1);

    if (error || !slots || slots.length === 0) {
      return false;
    }

    return true;
  }
}

export const rescheduleService = new RescheduleService();
