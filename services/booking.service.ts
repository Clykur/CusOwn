import { supabaseAdmin } from '@/lib/supabase/server';
import { generateUniqueId } from '@/lib/utils/string';
import { CreateBookingInput, Booking, BookingWithDetails } from '@/types';
import { ERROR_MESSAGES, BOOKING_STATUS, SLOT_STATUS, BOOKING_EXPIRY_HOURS } from '@/config/constants';
import { slotService } from './slot.service';
import { salonService } from './salon.service';

export class BookingService {
  async createBooking(data: CreateBookingInput): Promise<Booking> {
    const slot = await slotService.getSlotById(data.slot_id);

    if (!slot) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_FOUND);
    }

    // Slot should be reserved at this point (reserved in API route before calling this)
    // But double-check it's not booked
    if (slot.status === SLOT_STATUS.BOOKED) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_AVAILABLE);
    }

    if (slot.salon_id !== data.salon_id) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_AVAILABLE);
    }

    let bookingId = generateUniqueId();
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const { data: existing } = await supabaseAdmin
        .from('bookings')
        .select('id')
        .eq('booking_id', bookingId)
        .single();

      if (!existing) {
        isUnique = true;
      } else {
        bookingId = generateUniqueId();
        attempts++;
      }
    }

    if (!isUnique) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from('bookings')
      .insert({
        salon_id: data.salon_id,
        slot_id: data.slot_id,
        customer_name: data.customer_name,
        customer_phone: data.customer_phone,
        booking_id: bookingId,
        status: BOOKING_STATUS.PENDING,
      })
      .select()
      .single();

    if (bookingError) {
      throw new Error(bookingError.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!booking) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    // Mark slot as booked (this also clears reservation)
    await slotService.markSlotAsBooked(data.slot_id);

    return booking;
  }

  async getBookingById(bookingId: string): Promise<BookingWithDetails | null> {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('booking_id', bookingId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!data) {
      return null;
    }

    const salon = await salonService.getSalonById(data.salon_id);
    const slot = await slotService.getSlotById(data.slot_id);

    return {
      ...data,
      salon: salon || undefined,
      slot: slot || undefined,
    };
  }

  async getBookingByUuid(id: string): Promise<Booking | null> {
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data;
  }

  async getBookingByUuidWithDetails(id: string): Promise<BookingWithDetails | null> {
    const booking = await this.getBookingByUuid(id);

    if (!booking) {
      return null;
    }

    const salon = await salonService.getSalonById(booking.salon_id);
    const slot = await slotService.getSlotById(booking.slot_id);

    return {
      ...booking,
      salon: salon || undefined,
      slot: slot || undefined,
    };
  }

  async confirmBooking(bookingId: string): Promise<Booking> {
    const booking = await this.getBookingByUuid(bookingId);

    if (!booking) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    if (booking.status !== BOOKING_STATUS.PENDING) {
      throw new Error(`Booking is already ${booking.status}`);
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ status: BOOKING_STATUS.CONFIRMED })
      .eq('id', bookingId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!data) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    return data;
  }

  async rejectBooking(bookingId: string): Promise<Booking> {
    const booking = await this.getBookingByUuid(bookingId);

    if (!booking) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    if (booking.status !== BOOKING_STATUS.PENDING) {
      throw new Error(`Booking is already ${booking.status}`);
    }

    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ status: BOOKING_STATUS.REJECTED })
      .eq('id', bookingId)
      .select()
      .single();

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!data) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    await slotService.updateSlotStatus(booking.slot_id, SLOT_STATUS.AVAILABLE);

    return data;
  }

  async getSalonBookings(salonId: string, date?: string): Promise<BookingWithDetails[]> {
    let query = supabaseAdmin
      .from('bookings')
      .select('*')
      .eq('salon_id', salonId)
      .order('created_at', { ascending: false });

    if (date) {
      const { data: slots } = await supabaseAdmin
        .from('slots')
        .select('id')
        .eq('salon_id', salonId)
        .eq('date', date);

      if (slots && slots.length > 0) {
        const slotIds = slots.map((s) => s.id);
        query = query.in('slot_id', slotIds);
      } else {
        return [];
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!data || data.length === 0) {
      return [];
    }

    const bookingsWithDetails: BookingWithDetails[] = await Promise.all(
      data.map(async (booking) => {
        const salon = await salonService.getSalonById(booking.salon_id);
        const slot = await slotService.getSlotById(booking.slot_id);

        return {
          ...booking,
          salon: salon || undefined,
          slot: slot || undefined,
        };
      })
    );

    return bookingsWithDetails;
  }

  async expireOldBookings(): Promise<void> {
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() - BOOKING_EXPIRY_HOURS);

    const { data: expiredBookings, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, slot_id, status')
      .eq('status', BOOKING_STATUS.PENDING)
      .lt('created_at', expiryTime.toISOString());

    if (fetchError) {
      throw new Error(fetchError.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!expiredBookings || expiredBookings.length === 0) {
      return;
    }

    const bookingIds = expiredBookings.map((b) => b.id);
    const slotIds = expiredBookings.map((b) => b.slot_id);

    await supabaseAdmin
      .from('bookings')
      .update({ status: BOOKING_STATUS.CANCELLED })
      .in('id', bookingIds);

    await supabaseAdmin
      .from('slots')
      .update({ status: SLOT_STATUS.AVAILABLE })
      .in('id', slotIds);
  }
}

export const bookingService = new BookingService();

