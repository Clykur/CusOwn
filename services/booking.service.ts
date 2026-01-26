import { supabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase/server';
import { generateUniqueId, formatPhoneNumber } from '@/lib/utils/string';
import { CreateBookingInput, Booking, BookingWithDetails } from '@/types';
import { ERROR_MESSAGES, BOOKING_STATUS, SLOT_STATUS } from '@/config/constants';
import { env } from '@/config/env';
import { slotService } from './slot.service';
import { salonService } from './salon.service';
import { serviceService } from './service.service';
import { bookingStateMachine } from '@/lib/state/booking-state-machine';
import { emitBookingCreated, emitBookingConfirmed, emitBookingRejected, emitBookingCancelled } from '@/lib/events/booking-events';
import { metricsService } from '@/lib/monitoring/metrics';
import { cache } from 'react';

export class BookingService {
  async createBooking(data: CreateBookingInput, customerUserId?: string, serviceIds?: string[]): Promise<Booking> {
    const supabaseAdmin = requireSupabaseAdmin();

    let totalDurationMinutes = 0;
    let totalPriceCents = 0;
    let servicesCount = 1;
    let serviceData: any[] = [];

    if (serviceIds && serviceIds.length > 0) {
      if (serviceIds.length > 10) {
        throw new Error('Too many services');
      }

      const services = await serviceService.validateServices(serviceIds, data.salon_id);
      totalDurationMinutes = await serviceService.calculateTotalDuration(services);
      totalPriceCents = await serviceService.calculateTotalPrice(services);
      servicesCount = services.length;
      serviceData = services.map(s => ({
        service_id: s.id,
        price_cents: s.price_cents,
      }));
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

    const formattedPhone = formatPhoneNumber(data.customer_phone);

    const { data: result, error: funcError } = await supabaseAdmin.rpc(
      'create_booking_atomically',
      {
        p_business_id: data.salon_id,
        p_slot_id: data.slot_id,
        p_customer_name: data.customer_name,
        p_customer_phone: formattedPhone,
        p_booking_id: bookingId,
        p_customer_user_id: customerUserId || null,
        p_total_duration_minutes: totalDurationMinutes > 0 ? totalDurationMinutes : null,
        p_total_price_cents: totalPriceCents > 0 ? totalPriceCents : null,
        p_services_count: servicesCount,
        p_service_data: serviceData.length > 0 ? (serviceData as any) : null,
      }
    );

    if (funcError) {
      throw new Error(funcError.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!result || !result.success) {
      const errorMsg = result?.error || 'Booking creation failed';
      throw new Error(errorMsg);
    }

    const bookingUuid = result.booking_id;
    const booking = await this.getBookingByUuid(bookingUuid);

    if (!booking) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    const bookingWithDetails = await this.getBookingByUuidWithDetails(booking.id);
    if (bookingWithDetails) {
      await emitBookingCreated(bookingWithDetails);
      await metricsService.increment('bookings.created');
    }

    return booking;
  }

  getBookingById = cache(async (bookingId: string): Promise<BookingWithDetails | null> => {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, business_id, slot_id, customer_name, customer_phone, booking_id, status, cancelled_by, cancellation_reason, cancelled_at, customer_user_id, rescheduled_from_booking_id, rescheduled_at, rescheduled_by, reschedule_reason, no_show, no_show_marked_at, no_show_marked_by, created_at, updated_at')
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

    const salon = await salonService.getSalonById(data.business_id);
    const slot = await slotService.getSlotById(data.slot_id);

    return {
      ...data,
      salon: salon || undefined,
      slot: slot || undefined,
    };
  });

  async getBookingByUuid(id: string): Promise<Booking | null> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select('id, business_id, slot_id, customer_name, customer_phone, booking_id, status, cancelled_by, cancellation_reason, cancelled_at, customer_user_id, rescheduled_from_booking_id, rescheduled_at, rescheduled_by, reschedule_reason, no_show, no_show_marked_at, no_show_marked_by, created_at, updated_at')
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

    const salon = await salonService.getSalonById(booking.business_id);
    const slot = await slotService.getSlotById(booking.slot_id);

    return {
      ...booking,
      salon: salon || undefined,
      slot: slot || undefined,
    };
  }

  async confirmBooking(bookingId: string, actorId?: string): Promise<Booking> {
    const booking = await this.getBookingByUuid(bookingId);

    if (!booking) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    if (!bookingStateMachine.canTransition(booking.status, 'confirm')) {
      throw new Error(`Booking cannot be confirmed from ${booking.status} state`);
    }

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const { data: result, error: funcError } = await supabaseAdmin.rpc(
      'confirm_booking_atomically',
      {
        p_booking_id: bookingId,
        p_actor_id: actorId || null,
      }
    );

    if (funcError) {
      throw new Error(funcError.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!result || !result.success) {
      const errorMsg = result?.error || 'Booking confirmation failed';
      throw new Error(errorMsg);
    }

    const confirmedBooking = await this.getBookingByUuid(bookingId);
    if (!confirmedBooking) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    const bookingWithDetails = await this.getBookingByUuidWithDetails(bookingId);
    if (bookingWithDetails) {
      await emitBookingConfirmed(bookingWithDetails);
      await metricsService.increment('bookings.confirmed');
    }

    return confirmedBooking;
  }

  async rejectBooking(bookingId: string): Promise<Booking> {
    const booking = await this.getBookingByUuid(bookingId);

    if (!booking) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    if (!bookingStateMachine.canTransition(booking.status, 'reject')) {
      throw new Error(`Booking cannot be rejected from ${booking.status} state`);
    }

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
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

    const bookingWithDetails = await this.getBookingByUuidWithDetails(bookingId);
    if (bookingWithDetails) {
      await emitBookingRejected(bookingWithDetails);
      await metricsService.increment('bookings.rejected');
    }

    return data;
  }

  async getSalonBookings(salonId: string, date?: string): Promise<BookingWithDetails[]> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    let query = supabaseAdmin
      .from('bookings')
      .select('id, business_id, slot_id, customer_name, customer_phone, booking_id, status, cancelled_by, cancellation_reason, cancelled_at, customer_user_id, rescheduled_from_booking_id, rescheduled_at, rescheduled_by, reschedule_reason, no_show, no_show_marked_at, no_show_marked_by, created_at, updated_at')
      .eq('business_id', salonId)
      .order('created_at', { ascending: false });

    if (date) {
      const { data: slots } = await supabaseAdmin
        .from('slots')
        .select('id')
        .eq('business_id', salonId)
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
        const salon = await salonService.getSalonById(booking.business_id);
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
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const expiryTime = new Date();
    expiryTime.setHours(expiryTime.getHours() - env.booking.expiryHours);

    const { data: expiredBookings, error: fetchError } = await supabaseAdmin
      .from('bookings')
      .select('id, slot_id, status, business_id')
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
    const now = new Date().toISOString();

    await supabaseAdmin
      .from('bookings')
      .update({ 
        status: BOOKING_STATUS.CANCELLED,
        cancelled_by: 'system',
        cancelled_at: now
      })
      .in('id', bookingIds);

    for (const bookingId of bookingIds) {
      const bookingWithDetails = await this.getBookingByUuidWithDetails(bookingId);
      if (bookingWithDetails) {
        await emitBookingCancelled(bookingWithDetails, 'system');
      }
    }

    await supabaseAdmin
      .from('slots')
      .update({ status: SLOT_STATUS.AVAILABLE })
      .in('id', slotIds);
  }

  async cancelBookingByCustomer(bookingId: string, reason?: string): Promise<Booking> {
    const booking = await this.getBookingByUuid(bookingId);
    if (!booking) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    if (!bookingStateMachine.canTransition(booking.status, 'cancel')) {
      throw new Error(`Booking cannot be cancelled from ${booking.status} state`);
    }

    const bookingWithDetails = await this.getBookingByUuidWithDetails(bookingId);
    if (bookingWithDetails?.slot) {
      const slotDateTime = new Date(`${bookingWithDetails.slot.date}T${bookingWithDetails.slot.start_time}`);
      const hoursUntilAppointment = (slotDateTime.getTime() - new Date().getTime()) / (1000 * 60 * 60);
      if (hoursUntilAppointment < 2 && booking.status === BOOKING_STATUS.CONFIRMED) {
        throw new Error(ERROR_MESSAGES.CANCELLATION_TOO_LATE);
      }
    }

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ 
        status: BOOKING_STATUS.CANCELLED,
        cancelled_by: 'customer',
        cancellation_reason: reason || null,
        cancelled_at: now
      })
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

    if (bookingWithDetails) {
      await emitBookingCancelled(bookingWithDetails, 'customer');
      await metricsService.increment('bookings.cancelled');
    }

    return data;
  }

  async cancelBookingByOwner(bookingId: string, reason?: string): Promise<Booking> {
    const booking = await this.getBookingByUuid(bookingId);
    if (!booking) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    if (!bookingStateMachine.canTransition(booking.status, 'cancel')) {
      throw new Error(`Booking cannot be cancelled from ${booking.status} state`);
    }

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const now = new Date().toISOString();
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .update({ 
        status: BOOKING_STATUS.CANCELLED,
        cancelled_by: 'owner',
        cancellation_reason: reason || null,
        cancelled_at: now
      })
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

    const bookingWithDetails = await this.getBookingByUuidWithDetails(bookingId);
    if (bookingWithDetails) {
      await emitBookingCancelled(bookingWithDetails, 'owner');
      await metricsService.increment('bookings.cancelled');
    }

    return data;
  }

  async getCustomerBookings(customerUserId: string): Promise<BookingWithDetails[]> {
    console.log('[BOOKING_SERVICE] getCustomerBookings called for user:', customerUserId.substring(0, 8) + '...');
    
    if (!supabaseAdmin) {
      console.error('[BOOKING_SERVICE] Supabase admin not configured');
      throw new Error('Database not configured');
    }

    // Get user profile to check phone number
    console.log('[BOOKING_SERVICE] Fetching user profile...');
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('user_profiles')
      .select('phone_number')
      .eq('id', customerUserId)
      .single();

    if (profileError) {
      console.warn('[BOOKING_SERVICE] Error fetching profile:', profileError.message);
    } else {
      console.log('[BOOKING_SERVICE] User profile found:', {
        hasPhone: !!profile?.phone_number,
        phone: profile?.phone_number ? profile.phone_number.substring(0, 5) + '...' : 'N/A',
      });
    }

    // First, get bookings directly linked to user
    console.log('[BOOKING_SERVICE] Fetching bookings linked by customer_user_id...');
    const { data: linkedBookings, error: linkedError } = await supabaseAdmin
      .from('bookings')
      .select('id, business_id, slot_id, customer_name, customer_phone, booking_id, status, cancelled_by, cancellation_reason, cancelled_at, customer_user_id, rescheduled_from_booking_id, rescheduled_at, rescheduled_by, reschedule_reason, no_show, no_show_marked_at, no_show_marked_by, created_at, updated_at')
      .eq('customer_user_id', customerUserId)
      .order('created_at', { ascending: false });

    if (linkedError) {
      console.error('[BOOKING_SERVICE] Error fetching linked bookings:', linkedError);
      throw new Error(linkedError.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    console.log('[BOOKING_SERVICE] Linked bookings found:', {
      count: linkedBookings?.length || 0,
      bookings: linkedBookings?.map((b: any) => ({
        id: b.id?.substring(0, 8) + '...',
        booking_id: b.booking_id,
        status: b.status,
        phone: b.customer_phone?.substring(0, 5) + '...',
      })) || [],
    });

    // Also get bookings by phone number if user has phone in profile
    let phoneBookings: any[] = [];
    if (profile?.phone_number) {
      const formattedPhone = formatPhoneNumber(profile.phone_number);
      console.log('[BOOKING_SERVICE] Fetching bookings by phone number:', formattedPhone.substring(0, 5) + '...');
      
      const { data: phoneData, error: phoneError } = await supabaseAdmin
        .from('bookings')
        .select('id, business_id, slot_id, customer_name, customer_phone, booking_id, status, cancelled_by, cancellation_reason, cancelled_at, customer_user_id, rescheduled_from_booking_id, rescheduled_at, rescheduled_by, reschedule_reason, no_show, no_show_marked_at, no_show_marked_by, created_at, updated_at')
        .eq('customer_phone', formattedPhone)
        .is('customer_user_id', null) // Only get unlinked bookings
        .order('created_at', { ascending: false });

      if (phoneError) {
        console.warn('[BOOKING_SERVICE] Error fetching bookings by phone:', phoneError.message);
      } else if (phoneData) {
        phoneBookings = phoneData;
        console.log('[BOOKING_SERVICE] Phone bookings found:', {
          count: phoneBookings.length,
          bookings: phoneBookings.map((b: any) => ({
            id: b.id?.substring(0, 8) + '...',
            booking_id: b.booking_id,
            status: b.status,
          })),
        });
        
        // Link these bookings to the user for future access
        if (phoneBookings.length > 0) {
          const bookingIds = phoneBookings.map(b => b.id);
          console.log('[BOOKING_SERVICE] Linking', bookingIds.length, 'bookings to user...');
          try {
            const { error: updateError } = await supabaseAdmin
              .from('bookings')
              .update({ customer_user_id: customerUserId })
              .in('id', bookingIds);
            
            if (updateError) {
              console.warn('[BOOKING_SERVICE] Failed to link bookings to user:', updateError.message);
            } else {
              console.log('[BOOKING_SERVICE] Successfully linked', bookingIds.length, 'bookings to user');
            }
          } catch (updateError) {
            console.warn('[BOOKING_SERVICE] Exception linking bookings:', updateError);
          }
        }
      }
    } else {
      console.log('[BOOKING_SERVICE] No phone number in profile, skipping phone-based booking lookup');
    }

    // Combine and deduplicate bookings
    const allBookings = [...(linkedBookings || [])];
    const linkedIds = new Set((linkedBookings || []).map(b => b.id));
    
    for (const booking of phoneBookings) {
      if (!linkedIds.has(booking.id)) {
        allBookings.push(booking);
      }
    }

    console.log('[BOOKING_SERVICE] Total bookings after combining:', allBookings.length);

    if (allBookings.length === 0) {
      console.log('[BOOKING_SERVICE] No bookings found, returning empty array');
      return [];
    }

    console.log('[BOOKING_SERVICE] Fetching salon and slot details for', allBookings.length, 'bookings...');
    const bookingsWithDetails: BookingWithDetails[] = await Promise.all(
      allBookings.map(async (booking, index) => {
        try {
          console.log(`[BOOKING_SERVICE] Fetching details for booking ${index + 1}/${allBookings.length}:`, booking.id?.substring(0, 8) + '...');
          const salon = await salonService.getSalonById(booking.business_id);
          const slot = await slotService.getSlotById(booking.slot_id);
          
          console.log(`[BOOKING_SERVICE] Booking ${index + 1} details:`, {
            id: booking.id?.substring(0, 8) + '...',
            hasSalon: !!salon,
            hasSlot: !!slot,
            salonName: salon?.salon_name || 'N/A',
            slotDate: slot?.date || 'N/A',
          });
          
          return {
            ...booking,
            salon: salon || undefined,
            slot: slot || undefined,
          };
        } catch (detailError) {
          console.error(`[BOOKING_SERVICE] Error fetching details for booking ${index + 1}:`, detailError);
          return {
            ...booking,
            salon: undefined,
            slot: undefined,
          };
        }
      })
    );

    console.log('[BOOKING_SERVICE] Returning', bookingsWithDetails.length, 'bookings with details');
    return bookingsWithDetails;
  }
}

export const bookingService = new BookingService();

