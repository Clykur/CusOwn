import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';
import {
  bookingService,
  whatsappService,
  salonService,
  slotService,
  reminderService,
  requireAuth,
  getBookingStatusUrl,
  successResponse,
  errorResponse,
  enhancedRateLimit,
  setNoCacheHeaders,
  auditService,
  emitBookingCreated,
  safeMetrics,
  logBookingLifecycle,
  requireSupabaseAdmin,
  verifyPendingBookingCookie,
} from '@cusown/shared/server';
import { ERROR_MESSAGES, PENDING_BOOKING_COOKIE, METRICS_BOOKING_CREATED } from '@cusown/config';
import type { BookingWithDetails } from '@cusown/shared/server';

const IDEMPOTENCY_TTL_HOURS = 24;

const completeRateLimit = enhancedRateLimit({
  maxRequests: 20,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'book_complete',
});

const ROUTE = 'POST /api/book/complete';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ROUTE);
    if (auth instanceof Response) return auth;

    const rateLimitResponse = await completeRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const cookieStore = await cookies();
    const cookieValue = cookieStore.get(PENDING_BOOKING_COOKIE)?.value;
    const payload = verifyPendingBookingCookie(cookieValue);
    if (!payload) {
      return errorResponse('No pending booking or link expired. Please start again.', 400);
    }

    await bookingService.runLazyExpireIfNeeded();

    const idempotencyKey =
      'pending-' + createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 32);
    const supabase = requireSupabaseAdmin();

    const validatedData = {
      salon_id: payload.salon_id,
      slot_id: payload.slot_id,
      customer_name: payload.customer_name,
      customer_phone: payload.customer_phone,
    };

    const params = await bookingService.prepareCreateBookingParams(
      validatedData,
      auth.user.id,
      undefined
    );

    const { data: idemResult, error: idemError } = await supabase.rpc(
      'create_booking_idempotent_reserve',
      {
        p_key: idempotencyKey,
        p_ttl_hours: IDEMPOTENCY_TTL_HOURS,
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

    if (idemError) {
      throw new Error(idemError.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    const row = Array.isArray(idemResult) ? idemResult[0] : idemResult;
    const status = row?.status as string | undefined;
    const createdBookingId = row?.booking_id as string | undefined;

    if (status === 'in_progress') {
      return errorResponse('Duplicate request; try again shortly', 409);
    }
    if (status !== 'created' || !createdBookingId) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    const bookingWithDetailsFromDb =
      await bookingService.getBookingByUuidWithDetails(createdBookingId);
    if (!bookingWithDetailsFromDb) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }
    const booking = bookingWithDetailsFromDb;

    const salon = await salonService.getSalonById(validatedData.salon_id);
    if (!salon) {
      throw new Error(ERROR_MESSAGES.SALON_NOT_FOUND);
    }
    const updatedSlot = await slotService.getSlotById(validatedData.slot_id);
    if (!updatedSlot) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_FOUND);
    }
    if (updatedSlot.business_id !== validatedData.salon_id) {
      throw new Error('Slot does not belong to this salon');
    }

    const bookingWithDetails: BookingWithDetails = {
      ...booking,
      salon,
      slot: updatedSlot,
    };

    await emitBookingCreated(bookingWithDetails);
    safeMetrics.increment('bookings.created');
    safeMetrics.increment(METRICS_BOOKING_CREATED);
    logBookingLifecycle({
      booking_id: booking.id,
      slot_id: booking.slot_id,
      action: 'booking_created',
      actor: auth.user.id,
      source: 'api',
    });

    try {
      await whatsappService.generateBookingRequestMessage(bookingWithDetails, salon, request);
    } catch {
      // non-fatal
    }
    await reminderService.scheduleBookingReminders(booking.id);

    try {
      await auditService.createAuditLog(auth.user.id, 'booking_created', 'booking', {
        entityId: booking.id,
        description: `Booking created for ${validatedData.customer_name}`,
        request,
      });
    } catch {
      // non-fatal
    }

    cookieStore.set(PENDING_BOOKING_COOKIE, '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    const bookingStatusUrl = new URL(getBookingStatusUrl(booking.booking_id, request));
    bookingStatusUrl.searchParams.set('justBooked', 'true');
    const response = successResponse({
      booking_id: booking.booking_id,
      booking_status_url: bookingStatusUrl.toString(),
    });
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 400);
  }
}
