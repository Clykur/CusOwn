import { supabaseAdmin } from '@/lib/supabase/server';
import { bookingService } from './booking.service';
import { slotService } from './slot.service';
import { ERROR_MESSAGES, BOOKING_STATUS, SLOT_STATUS } from '@/config/constants';
import { env } from '@/config/env';

export interface RescheduleInput {
  bookingId: string;
  newSlotId: string;
  rescheduledBy: 'customer' | 'owner';
  reason?: string;
}

export class RescheduleService {
  /**
   * Reschedule via atomic RPC: locks both slots, validates, releases old, updates booking, writes audit.
   */
  async rescheduleBooking(input: RescheduleInput): Promise<any> {
    const supabase = supabaseAdmin;
    if (!supabase) {
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

    if (input.newSlotId === booking.slot_id) {
      throw new Error('New slot must be different from current slot');
    }

    const maxRescheduleCount = env.booking.maxRescheduleCount;
    const { data: result, error } = await supabase.rpc('reschedule_booking', {
      p_booking_id: input.bookingId,
      p_new_slot_id: input.newSlotId,
      p_rescheduled_by: input.rescheduledBy,
      p_reschedule_reason: input.reason ?? null,
      p_max_reschedule_count: maxRescheduleCount,
    });

    if (error) {
      const msg = error.message ?? ERROR_MESSAGES.DATABASE_ERROR;
      if (msg.includes('Max reschedule count exceeded')) {
        throw new Error(ERROR_MESSAGES.RESCHEDULE_MAX_EXCEEDED);
      }
      throw new Error(msg);
    }

    const out = result as { success?: boolean; error?: string };
    if (!out?.success) {
      const err = (out?.error as string) || ERROR_MESSAGES.DATABASE_ERROR;
      if (err.includes('Max reschedule count exceeded')) {
        throw new Error(ERROR_MESSAGES.RESCHEDULE_MAX_EXCEEDED);
      }
      throw new Error(err);
    }

    return bookingService.getBookingByUuidWithDetails(input.bookingId);
  }

  /**
   * Reschedule history from booking_lifecycle_audit (reschedule actions).
   */
  async getRescheduleHistory(bookingId: string): Promise<any[]> {
    const supabase = supabaseAdmin;
    if (!supabase) {
      throw new Error('Database not configured');
    }

    const booking = await bookingService.getBookingByUuidWithDetails(bookingId);
    if (!booking) {
      return [];
    }

    const { data, error } = await supabase
      .from('booking_lifecycle_audit')
      .select('id, old_slot_id, new_slot_id, action_type, actor_type, created_at')
      .eq('booking_id', bookingId)
      .eq('action_type', 'reschedule')
      .order('created_at', { ascending: false });

    if (error) {
      throw new Error(error.message ?? ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data ?? [];
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
