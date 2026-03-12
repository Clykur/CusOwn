import { supabaseAdmin, requireSupabaseAdmin } from '@/lib/supabase/server';
import { generateUniqueId, formatPhoneNumber } from '@/lib/utils/string';
import { CreateBookingInput, Booking, BookingWithDetails, Salon, Slot } from '@/types';
import {
  ERROR_MESSAGES,
  BOOKING_STATUS,
  SLOT_STATUS,
  UNDO_ACCEPT_REJECT_WINDOW_MINUTES,
  BOOKING_LIST_MAX_PAGE_SIZE,
} from '@/config/constants';
import { env } from '@/config/env';
import { slotService } from './slot.service';
import { salonService } from './salon.service';
import { serviceService } from './service.service';
import { canTransition } from '@/services/booking-state-machine.service';
import {
  emitBookingCreated,
  emitBookingConfirmed,
  emitBookingRejected,
  emitBookingCancelled,
} from '@/lib/events/booking-events';
import { safeMetrics } from '@/lib/monitoring/safe-metrics';
import { auditService } from '@/services/audit.service';
import { getReviewsByBookingIds } from '@/services/review.service';
import { logBookingLifecycle } from '@/lib/monitoring/lifecycle-structured-log';
import {
  METRICS_BOOKING_CREATED,
  METRICS_BOOKING_CONFIRMED,
  METRICS_BOOKING_REJECTED,
  METRICS_BOOKING_CANCELLED_USER,
  METRICS_BOOKING_CANCELLED_SYSTEM,
  METRICS_OBSERVABILITY_BOOKING_SUCCESS_TOTAL,
  METRICS_OBSERVABILITY_CANCELLATION_TOTAL,
  METRICS_INVALID_STATE_TRANSITION_TOTAL,
} from '@/config/constants';
import { cache } from 'react';
import { bookingEventsAnalyticsService } from '@/services/booking-events-analytics.service';

export type CreateBookingRpcParams = {
  p_business_id: string;
  p_slot_id: string;
  p_customer_name: string;
  p_customer_phone: string;
  p_booking_id: string;
  p_customer_user_id: string | null;
  p_total_duration_minutes: number | null;
  p_total_price_cents: number | null;
  p_services_count: number;
  p_service_data: { service_id: string; price_cents: number }[] | null;
};

export class BookingService {
  // Undo/restoreBooking feature removed
  /**
   * Prepares params for create_booking_atomically / create_booking_idempotent_reserve.
   * Validates services and generates unique booking_id.
   */
  async prepareCreateBookingParams(
    data: CreateBookingInput,
    customerUserId?: string | null,
    serviceIds?: string[]
  ): Promise<CreateBookingRpcParams> {
    const supabaseAdmin = requireSupabaseAdmin();
    let totalDurationMinutes = 0;
    let totalPriceCents = 0;
    let servicesCount = 1;
    let serviceData: { service_id: string; price_cents: number }[] = [];

    if (serviceIds && serviceIds.length > 0) {
      if (serviceIds.length > 10) {
        throw new Error('Too many services');
      }
      const services = await serviceService.validateServices(serviceIds, data.salon_id);
      totalDurationMinutes = await serviceService.calculateTotalDuration(services);
      totalPriceCents = await serviceService.calculateTotalPrice(services);
      servicesCount = services.length;
      serviceData = services.map((s) => ({
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
    return {
      p_business_id: data.salon_id,
      p_slot_id: data.slot_id,
      p_customer_name: data.customer_name,
      p_customer_phone: formattedPhone,
      p_booking_id: bookingId,
      p_customer_user_id: customerUserId ?? null,
      p_total_duration_minutes: totalDurationMinutes > 0 ? totalDurationMinutes : null,
      p_total_price_cents: totalPriceCents > 0 ? totalPriceCents : null,
      p_services_count: servicesCount,
      p_service_data: serviceData.length > 0 ? serviceData : null,
    };
  }

  async createBooking(
    data: CreateBookingInput,
    customerUserId?: string,
    serviceIds?: string[]
  ): Promise<Booking> {
    const supabaseAdmin = requireSupabaseAdmin();
    const params = await this.prepareCreateBookingParams(data, customerUserId, serviceIds);

    const { data: result, error: funcError } = await supabaseAdmin.rpc(
      'create_booking_atomically',
      {
        p_business_id: params.p_business_id,
        p_slot_id: params.p_slot_id,
        p_customer_name: params.p_customer_name,
        p_customer_phone: params.p_customer_phone,
        p_booking_id: params.p_booking_id,
        p_customer_user_id: params.p_customer_user_id,
        p_total_duration_minutes: params.p_total_duration_minutes,
        p_total_price_cents: params.p_total_price_cents,
        p_services_count: params.p_services_count,
        p_service_data: params.p_service_data,
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
      try {
        await emitBookingCreated(bookingWithDetails);
      } catch (notifyErr) {
        console.error('Notification/event failed after booking created:', notifyErr);
        // Booking already committed; do not fail the request (failure handling: notification fail ≠ booking fail).
      }
      safeMetrics.increment('bookings.created');
      safeMetrics.increment(METRICS_BOOKING_CREATED);
      logBookingLifecycle({
        booking_id: booking.id,
        slot_id: booking.slot_id,
        action: 'booking_created',
        actor: customerUserId || 'anonymous',
        source: 'api',
      });
      void bookingEventsAnalyticsService.recordEvent({
        bookingId: booking.id,
        eventType: 'created',
        actorType: customerUserId ? 'customer' : 'system',
        actorId: customerUserId ?? null,
        source: 'api',
      });
    }

    return booking;
  }

  getBookingById = cache(async (bookingId: string): Promise<BookingWithDetails | null> => {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, business_id, slot_id, customer_name, customer_phone, booking_id, status, cancelled_by, cancellation_reason, cancelled_at, customer_user_id, rescheduled_from_booking_id, rescheduled_at, rescheduled_by, reschedule_reason, no_show, no_show_marked_at, no_show_marked_by, created_at, updated_at, undo_used_at'
      )
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

    const [salon, slot, reviewMap] = await Promise.all([
      salonService.getSalonById(data.business_id),
      slotService.getSlotById(data.slot_id),
      getReviewsByBookingIds([data.id]),
    ]);

    return {
      ...data,
      salon: salon || undefined,
      slot: slot || undefined,
      review: reviewMap.get(data.id) ?? undefined,
    };
  });

  async getBookingByUuid(id: string): Promise<Booking | null> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    const { data, error } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, business_id, slot_id, customer_name, customer_phone, booking_id, status, cancelled_by, cancellation_reason, cancelled_at, customer_user_id, rescheduled_from_booking_id, rescheduled_at, rescheduled_by, reschedule_reason, no_show, no_show_marked_at, no_show_marked_by, created_at, updated_at, undo_used_at'
      )
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

    const [salon, slot, reviewMap] = await Promise.all([
      salonService.getSalonById(booking.business_id),
      slotService.getSlotById(booking.slot_id),
      getReviewsByBookingIds([booking.id]),
    ]);

    return {
      ...booking,
      salon: salon || undefined,
      slot: slot || undefined,
      review: reviewMap.get(booking.id) ?? undefined,
    };
  }

  async confirmBooking(bookingId: string, actorId?: string): Promise<Booking> {
    const booking = await this.getBookingByUuid(bookingId);

    if (!booking) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    const allowed = await canTransition(booking.status, 'confirm');
    if (!allowed) {
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
      if (String(funcError.message || '').includes('Invalid booking transition')) {
        safeMetrics.increment(METRICS_INVALID_STATE_TRANSITION_TOTAL);
      }
      throw new Error(funcError.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!result || !result.success) {
      const errorMsg = result?.error || 'Booking confirmation failed';
      if (String(errorMsg).includes('Invalid booking transition')) {
        safeMetrics.increment(METRICS_INVALID_STATE_TRANSITION_TOTAL);
      }
      if (errorMsg.includes('Another booking for this slot is already confirmed')) {
        throw new Error(ERROR_MESSAGES.SLOT_ALREADY_BOOKED);
      }
      throw new Error(errorMsg);
    }

    const confirmedBooking = await this.getBookingByUuid(bookingId);
    if (!confirmedBooking) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    const bookingWithDetails = await this.getBookingByUuidWithDetails(bookingId);
    if (bookingWithDetails) {
      await emitBookingConfirmed(bookingWithDetails);
      safeMetrics.increment('bookings.confirmed');
      safeMetrics.increment(METRICS_BOOKING_CONFIRMED);
      safeMetrics.increment(METRICS_OBSERVABILITY_BOOKING_SUCCESS_TOTAL);
      logBookingLifecycle({
        booking_id: bookingId,
        slot_id: bookingWithDetails.slot_id,
        action: 'booking_confirmed',
        actor: actorId || 'system',
        source: 'api',
      });
    }

    return confirmedBooking;
  }

  async rejectBooking(bookingId: string, actorId?: string | null): Promise<Booking> {
    const booking = await this.getBookingByUuid(bookingId);

    if (!booking) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    const allowed = await canTransition(booking.status, 'reject');
    if (!allowed) {
      throw new Error(`Booking cannot be rejected from ${booking.status} state`);
    }

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const { data: result, error: rpcError } = await supabaseAdmin.rpc('reject_booking_atomically', {
      p_booking_id: bookingId,
      p_actor_id: actorId ?? null,
    });

    if (rpcError) {
      if (String(rpcError.message || '').includes('Invalid booking transition')) {
        safeMetrics.increment(METRICS_INVALID_STATE_TRANSITION_TOTAL);
      }
      throw new Error(rpcError.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!result?.success) {
      const errMsg = (result?.error as string) || ERROR_MESSAGES.DATABASE_ERROR;
      if (String(errMsg).includes('Invalid booking transition')) {
        safeMetrics.increment(METRICS_INVALID_STATE_TRANSITION_TOTAL);
      }
      throw new Error(errMsg);
    }

    const bookingWithDetails = await this.getBookingByUuidWithDetails(bookingId);
    const updated = await this.getBookingByUuid(bookingId);
    if (!updated) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (bookingWithDetails) {
      await emitBookingRejected(bookingWithDetails);
      safeMetrics.increment('bookings.rejected');
      safeMetrics.increment(METRICS_BOOKING_REJECTED);
      logBookingLifecycle({
        booking_id: bookingId,
        slot_id: booking.slot_id,
        action: 'booking_rejected',
        actor: actorId ?? 'owner',
        source: 'api',
      });
    }

    return updated;
  }

  /**
   * Revert confirmed booking to pending (undo accept). Guaranteed by DB RPC for single-use, 5m window, and ownership.
   */
  async revertConfirmToPending(bookingId: string, actorId: string): Promise<Booking> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      'undo_confirm_booking_atomically',
      { p_booking_id: bookingId, p_actor_id: actorId }
    );

    if (rpcError) {
      throw new Error(rpcError.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!result?.success) {
      const err = (result?.error as string) || ERROR_MESSAGES.DATABASE_ERROR;

      // Map DB errors to structured ERROR_MESSAGES
      if (err.includes('Undo already used')) {
        throw new Error(ERROR_MESSAGES.UNDO_ALREADY_USED);
      }
      if (err.includes('Undo window expired')) {
        throw new Error(ERROR_MESSAGES.UNDO_WINDOW_EXPIRED);
      }
      if (err.includes('Unauthorized')) {
        throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
      }
      if (
        err.includes('confirmed') &&
        (err.includes('not in') || err.includes('not in confirmed'))
      ) {
        throw new Error(ERROR_MESSAGES.BOOKING_NOT_CONFIRMED);
      }
      if (err === 'Booking not found') {
        throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
      }
      if (err.includes('Slot no longer available') || err.includes('Slot update failed')) {
        throw new Error(ERROR_MESSAGES.SLOT_NO_LONGER_AVAILABLE);
      }

      throw new Error(err);
    }

    try {
      const { reminderService } = await import('@/services/reminder.service');
      await reminderService.cancelRemindersForBooking(bookingId);
    } catch {
      // Do not block undo on reminder cancellation
    }

    const updated = await this.getBookingByUuid(bookingId);
    if (!updated) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    logBookingLifecycle({
      booking_id: bookingId,
      slot_id: updated.slot_id,
      action: 'booking_undo_accept',
      actor: actorId,
      source: 'api',
    });

    return updated;
  }

  /**
   * Revert rejected booking to pending (undo reject). Guaranteed by DB RPC.
   */
  async revertRejectToPending(bookingId: string, actorId: string): Promise<Booking> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      'undo_reject_booking_atomically',
      { p_booking_id: bookingId, p_actor_id: actorId }
    );

    if (rpcError) {
      throw new Error(rpcError.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!result?.success) {
      const err = (result?.error as string) || ERROR_MESSAGES.DATABASE_ERROR;

      // Map DB errors
      if (err.includes('Undo already used')) {
        throw new Error(ERROR_MESSAGES.UNDO_ALREADY_USED);
      }
      if (err.includes('Undo window expired')) {
        throw new Error(ERROR_MESSAGES.UNDO_WINDOW_EXPIRED);
      }
      if (err.includes('Unauthorized')) {
        throw new Error(ERROR_MESSAGES.UNAUTHORIZED);
      }
      if (err.includes('Slot') || err.includes('available')) {
        throw new Error(ERROR_MESSAGES.SLOT_NO_LONGER_AVAILABLE);
      }
      if (err.includes('rejected') && (err.includes('not in') || err.includes('not in rejected'))) {
        throw new Error(ERROR_MESSAGES.BOOKING_NOT_REJECTED);
      }
      if (err === 'Booking not found') {
        throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
      }

      throw new Error(err);
    }

    const updated = await this.getBookingByUuid(bookingId);
    if (!updated) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    logBookingLifecycle({
      booking_id: bookingId,
      slot_id: updated.slot_id,
      action: 'booking_undo_reject',
      actor: actorId,
      source: 'api',
    });

    return updated;
  }

  private static BOOKING_SELECT =
    'id, business_id, slot_id, customer_name, customer_phone, booking_id, status, cancelled_by, cancellation_reason, cancelled_at, customer_user_id, rescheduled_from_booking_id, rescheduled_at, rescheduled_by, reschedule_reason, reschedule_count, late_cancellation, no_show, no_show_marked_at, no_show_marked_by, created_at, updated_at, undo_used_at';
  private static BOOKING_SELECT_WITHOUT_UNDO =
    'id, business_id, slot_id, customer_name, customer_phone, booking_id, status, cancelled_by, cancellation_reason, cancelled_at, customer_user_id, rescheduled_from_booking_id, rescheduled_at, rescheduled_by, reschedule_reason, reschedule_count, late_cancellation, no_show, no_show_marked_at, no_show_marked_by, created_at, updated_at';

  /**
   * Batch-fetch bookings with details by UUIDs. Used to avoid N+1 in expireOldBookings.
   */
  private async getBookingsWithDetailsBatch(ids: string[]): Promise<BookingWithDetails[]> {
    if (!supabaseAdmin || ids.length === 0) return [];
    const { data: rows, error } = await supabaseAdmin
      .from('bookings')
      .select(BookingService.BOOKING_SELECT_WITHOUT_UNDO)
      .in('id', ids);
    if (error || !rows || rows.length === 0) return [];
    const bookings = rows as unknown as Booking[];
    const businessIds = [...new Set(bookings.map((b) => b.business_id))];
    const slotIds = [...new Set(bookings.map((b) => b.slot_id))];
    const [businessesRes, slotsRes, reviewMap] = await Promise.all([
      businessIds.length
        ? supabaseAdmin
            .from('businesses')
            .select(
              'id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, booking_link, address, location, category, qr_code, owner_user_id, created_at, updated_at, rating_avg, review_count'
            )
            .in('id', businessIds)
        : Promise.resolve({ data: [] }),
      slotIds.length
        ? supabaseAdmin
            .from('slots')
            .select('id, business_id, date, start_time, end_time, status, reserved_until')
            .in('id', slotIds)
        : Promise.resolve({ data: [] }),
      getReviewsByBookingIds(bookings.map((b) => b.id)),
    ]);
    const salonList = (businessesRes.data ?? []) as Salon[];
    const slotList = (slotsRes.data ?? []) as Slot[];
    const salonMap = new Map<string, Salon>();
    salonList.forEach((s) => salonMap.set(s.id, s));
    const slotMap = new Map<string, Slot>();
    slotList.forEach((s) => slotMap.set(s.id, s));
    return bookings.map((booking) => ({
      ...booking,
      salon: salonMap.get(booking.business_id) ?? undefined,
      slot: slotMap.get(booking.slot_id) ?? undefined,
      review: reviewMap.get(booking.id) ?? undefined,
    }));
  }

  async getSalonBookings(
    salonId: string,
    fromDate?: string,
    toDate?: string
  ): Promise<BookingWithDetails[]> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }
    let query = supabaseAdmin
      .from('bookings')
      .select(BookingService.BOOKING_SELECT)
      .eq('business_id', salonId)
      .order('created_at', { ascending: false })
      .limit(BOOKING_LIST_MAX_PAGE_SIZE);

    if (fromDate || toDate) {
      let slotQuery = supabaseAdmin.from('slots').select('id').eq('business_id', salonId);

      // same day filter
      if (fromDate && toDate && fromDate === toDate) {
        slotQuery = slotQuery.eq('date', fromDate);
      } else {
        if (fromDate) slotQuery = slotQuery.gte('date', fromDate);
        if (toDate) slotQuery = slotQuery.lte('date', toDate);
      }

      const { data: slots } = await slotQuery;

      if (slots && slots.length > 0) {
        const slotIds = slots.map((s) => s.id);
        query = query.in('slot_id', slotIds);
      } else {
        return [];
      }
    }

    let { data, error } = await query;
    let bookingRows: Booking[] | null = (data as Booking[] | null) ?? null;

    if (error && (error.message?.includes('undo_used_at') || error.message?.includes('column'))) {
      query = supabaseAdmin
        .from('bookings')
        .select(BookingService.BOOKING_SELECT_WITHOUT_UNDO)
        .eq('business_id', salonId)
        .order('created_at', { ascending: false })
        .limit(BOOKING_LIST_MAX_PAGE_SIZE);
      if (fromDate || toDate) {
        let slotQuery = supabaseAdmin.from('slots').select('id').eq('business_id', salonId);

        if (fromDate) slotQuery = slotQuery.gte('date', fromDate);
        if (toDate) slotQuery = slotQuery.lte('date', toDate);

        const { data: slots } = await slotQuery;
        if (slots && slots.length > 0) {
          const slotIds = slots.map((s) => s.id);
          query = query.in('slot_id', slotIds);
        } else {
          return [];
        }
      }
      const fallback = await query;
      error = fallback.error;
      const rawData = fallback.data as Record<string, unknown>[] | null;
      if (rawData && rawData.length > 0) {
        bookingRows = rawData.map((row) => ({
          ...row,
          undo_used_at: null,
        })) as Booking[];
      } else {
        bookingRows = rawData as Booking[] | null;
      }
    }

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const rows: Booking[] = bookingRows ?? [];
    if (rows.length === 0) {
      return [];
    }

    const slotIds = [...new Set(rows.map((b) => b.slot_id))];
    const [salon, slotsData] = await Promise.all([
      salonService.getSalonById(salonId),
      slotIds.length
        ? supabaseAdmin
            .from('slots')
            .select('id, business_id, date, start_time, end_time, status, reserved_until')
            .in('id', slotIds)
        : Promise.resolve({ data: [] }),
    ]);
    const slotList = (slotsData.data ?? []) as Slot[];
    const slotMap = new Map<string, Slot>();
    slotList.forEach((s) => slotMap.set(s.id, s));

    const reviewMap = await getReviewsByBookingIds(rows.map((b) => b.id));

    const bookingsWithDetails: BookingWithDetails[] = rows.map((booking) => ({
      ...booking,
      salon: salon ?? undefined,
      slot: slotMap.get(booking.slot_id) ?? undefined,
      review: reviewMap.get(booking.id) ?? undefined,
    }));

    return bookingsWithDetails;
  }

  /**
   * Expire pending bookings older than env.booking.expiryHours.
   * Uses DB RPC expire_pending_bookings_atomically for transactional safety (booking + slot in one transaction).
   * Emits events and audit logs for each expired booking after the RPC succeeds.
   * Phase 3: source drives metrics (expired_by_cron vs expired_by_lazy_heal).
   */
  async expireOldBookings(options?: { source?: 'cron' | 'lazy_heal' }): Promise<void> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const source = options?.source ?? 'cron';
    const metricName =
      source === 'lazy_heal' ? 'bookings.expired_by_lazy_heal' : 'bookings.expired_by_cron';

    const { data: result, error: rpcError } = await supabaseAdmin.rpc(
      'expire_pending_bookings_atomically',
      {
        p_expiry_hours: env.booking.expiryHours,
      }
    );

    if (rpcError) {
      throw new Error(rpcError.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!result || !result.success) {
      const errMsg = result?.error || 'Expire bookings RPC failed';
      throw new Error(errMsg);
    }

    const bookingIds: string[] = Array.isArray(result.booking_ids) ? result.booking_ids : [];
    if (bookingIds.length === 0) {
      return;
    }

    const bookingsWithDetails = await this.getBookingsWithDetailsBatch(bookingIds);
    const detailsById = new Map(bookingsWithDetails.map((b) => [b.id, b]));

    for (const bookingId of bookingIds) {
      const bookingWithDetails = detailsById.get(bookingId);
      if (bookingWithDetails) {
        await emitBookingCancelled(bookingWithDetails, 'system');
        safeMetrics.increment(metricName);
        safeMetrics.increment(METRICS_BOOKING_CANCELLED_SYSTEM);
        safeMetrics.increment(METRICS_OBSERVABILITY_CANCELLATION_TOTAL);
        logBookingLifecycle({
          booking_id: bookingId,
          slot_id: bookingWithDetails.slot_id,
          action: 'booking_cancelled',
          actor: 'system',
          source: source,
          reason: 'expired',
        });
        try {
          await auditService.createAuditLog(null, 'booking_cancelled', 'booking', {
            entityId: bookingId,
            description: 'Booking expired by system',
            newData: {
              status: BOOKING_STATUS.CANCELLED,
              cancelled_by: 'system',
            },
          });
        } catch (auditErr) {
          console.error('[AUDIT] Failed to log expired booking:', auditErr);
        }
      }
    }
  }

  /**
   * Phase 3: Run lazy expiration (same RPC as cron). Safe to call on every booking read/mutation.
   * Does not throw — failures are logged so user request is not broken.
   */
  async runLazyExpireIfNeeded(): Promise<void> {
    try {
      await this.expireOldBookings({ source: 'lazy_heal' });
    } catch (err) {
      console.error(
        '[LAZY_EXPIRE] Failed to run lazy expire:',
        err instanceof Error ? err.message : err
      );
    }
  }

  async cancelBookingByCustomer(bookingId: string, reason?: string): Promise<Booking> {
    const booking = await this.getBookingByUuid(bookingId);
    if (!booking) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    const cancelAllowed = await canTransition(booking.status, 'cancel');
    if (!cancelAllowed) {
      throw new Error(`Booking cannot be cancelled from ${booking.status} state`);
    }

    const bookingWithDetails = await this.getBookingByUuidWithDetails(bookingId);
    if (bookingWithDetails?.slot) {
      const slotDateTime = new Date(
        `${bookingWithDetails.slot.date}T${bookingWithDetails.slot.start_time}`
      );
      const hoursUntilAppointment =
        (slotDateTime.getTime() - new Date().getTime()) / (1000 * 60 * 60);
      if (
        hoursUntilAppointment < env.booking.cancellationMinHoursBefore &&
        booking.status === 'confirmed'
      ) {
        throw new Error(ERROR_MESSAGES.CANCELLATION_TOO_LATE);
      }
    }

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const defaultWindowMinutes = env.booking.cancellationMinHoursBefore * 60;
    const { data: result, error } = await supabaseAdmin.rpc('cancel_booking_atomically', {
      p_booking_id: bookingId,
      p_cancelled_by: 'customer',
      p_cancellation_reason: reason ?? null,
      p_default_cancellation_window_minutes: defaultWindowMinutes,
    });

    if (error) {
      if (String(error.message || '').includes('Invalid booking transition')) {
        safeMetrics.increment(METRICS_INVALID_STATE_TRANSITION_TOTAL);
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const out = result as { success?: boolean; error?: string };
    if (!out?.success) {
      throw new Error((out?.error as string) || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const data = await this.getBookingByUuid(bookingId);
    if (!data) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    const updatedWithDetails = await this.getBookingByUuidWithDetails(bookingId);
    if (updatedWithDetails) {
      await emitBookingCancelled(updatedWithDetails, 'customer');
      safeMetrics.increment('bookings.cancelled');
      safeMetrics.increment(METRICS_OBSERVABILITY_CANCELLATION_TOTAL);
      safeMetrics.increment(METRICS_BOOKING_CANCELLED_USER);
      logBookingLifecycle({
        booking_id: bookingId,
        slot_id: booking.slot_id,
        action: 'booking_cancelled',
        actor: 'customer',
        source: 'api',
        reason: reason || undefined,
      });
      void bookingEventsAnalyticsService.recordEvent({
        bookingId,
        eventType: 'cancelled',
        actorType: 'customer',
        actorId: booking.customer_user_id ?? null,
        source: 'api',
      });
    }

    return data;
  }

  async cancelBookingByOwner(bookingId: string, reason?: string): Promise<Booking> {
    const booking = await this.getBookingByUuid(bookingId);
    if (!booking) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    const cancelAllowed = await canTransition(booking.status, 'cancel');
    if (!cancelAllowed) {
      throw new Error(`Booking cannot be cancelled from ${booking.status} state`);
    }

    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const defaultWindowMinutes = env.booking.cancellationMinHoursBefore * 60;
    const { data: result, error } = await supabaseAdmin.rpc('cancel_booking_atomically', {
      p_booking_id: bookingId,
      p_cancelled_by: 'owner',
      p_cancellation_reason: reason ?? null,
      p_default_cancellation_window_minutes: defaultWindowMinutes,
    });

    if (error) {
      if (String(error.message || '').includes('Invalid booking transition')) {
        safeMetrics.increment(METRICS_INVALID_STATE_TRANSITION_TOTAL);
      }
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const out = result as { success?: boolean; error?: string };
    if (!out?.success) {
      throw new Error((out?.error as string) || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const data = await this.getBookingByUuid(bookingId);
    if (!data) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    const bookingWithDetails = await this.getBookingByUuidWithDetails(bookingId);
    if (bookingWithDetails) {
      await emitBookingCancelled(bookingWithDetails, 'owner');
      safeMetrics.increment('bookings.cancelled');
      safeMetrics.increment(METRICS_OBSERVABILITY_CANCELLATION_TOTAL);
      safeMetrics.increment(METRICS_BOOKING_CANCELLED_USER);
      logBookingLifecycle({
        booking_id: bookingId,
        slot_id: booking.slot_id,
        action: 'booking_cancelled',
        actor: 'owner',
        source: 'api',
        reason: reason || undefined,
      });
      void bookingEventsAnalyticsService.recordEvent({
        bookingId,
        eventType: 'cancelled',
        actorType: 'owner',
        actorId: null,
        source: 'api',
      });
    }

    return data;
  }

  async getCustomerBookings(customerUserId: string): Promise<BookingWithDetails[]> {
    if (!supabaseAdmin) {
      throw new Error('Database not configured');
    }

    const { data: bookings, error } = await supabaseAdmin
      .from('bookings')
      .select(
        'id, business_id, slot_id, customer_name, customer_phone, booking_id, status, cancelled_by, cancellation_reason, cancelled_at, customer_user_id, rescheduled_from_booking_id, rescheduled_at, rescheduled_by, reschedule_reason, no_show, no_show_marked_at, no_show_marked_by, created_at, updated_at, undo_used_at'
      )
      .eq('customer_user_id', customerUserId)
      .order('created_at', { ascending: false })
      .limit(BOOKING_LIST_MAX_PAGE_SIZE);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const list = bookings ?? [];
    if (list.length === 0) return [];

    const businessIds = [...new Set(list.map((b: { business_id: string }) => b.business_id))];
    const slotIds = [...new Set(list.map((b: { slot_id: string }) => b.slot_id))];

    const [businesses, slots] = await Promise.all([
      businessIds.length
        ? supabaseAdmin
            .from('businesses')
            .select(
              'id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, booking_link, address, location, category, qr_code, owner_user_id, created_at, updated_at'
            )
            .in('id', businessIds)
        : Promise.resolve({ data: [] }),
      slotIds.length
        ? supabaseAdmin
            .from('slots')
            .select('id, business_id, date, start_time, end_time, status, reserved_until')
            .in('id', slotIds)
        : Promise.resolve({ data: [] }),
    ]);

    const salonList = (businesses.data ?? []) as Salon[];
    const slotList = (slots.data ?? []) as Slot[];
    const salonMap = new Map<string, Salon>();
    salonList.forEach((s) => salonMap.set(s.id, s));
    const slotMap = new Map<string, Slot>();
    slotList.forEach((s) => slotMap.set(s.id, s));

    const reviewMap = await getReviewsByBookingIds(list.map((b: { id: string }) => b.id));

    const bookingsWithDetails: BookingWithDetails[] = list.map((booking: Booking) => ({
      ...booking,
      salon: salonMap.get(booking.business_id) ?? undefined,
      slot: slotMap.get(booking.slot_id) ?? undefined,
      review: reviewMap.get(booking.id) ?? undefined,
    }));

    return bookingsWithDetails;
  }
}

export const bookingService = new BookingService();
