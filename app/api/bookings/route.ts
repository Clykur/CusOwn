import { NextRequest, NextResponse } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { whatsappService } from '@/services/whatsapp.service';
import { salonService } from '@/services/salon.service';
import { slotService } from '@/services/slot.service';
import { reminderService } from '@/services/reminder.service';
import { businessHoursService } from '@/services/business-hours.service';
import { validateCreateBooking } from '@/lib/utils/validation';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getClientIp, isValidUUID } from '@/lib/utils/security';
import { getServerUser } from '@/lib/supabase/server-auth';
import { getBookingStatusUrl } from '@/lib/utils/url';
import { bookingRateLimitEnhanced } from '@/lib/security/rate-limit-api.security';
import { setNoCacheHeaders } from '@/lib/cache/next-cache';
import {
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  BOOKING_IDEMPOTENCY_HEADER,
  METRICS_BOOKING_CREATED,
} from '@/config/constants';
import { BookingWithDetails } from '@/types';
import { auditService } from '@/services/audit.service';
import { emitBookingCreated } from '@/lib/events/booking-events';
import { metricsService } from '@/lib/monitoring/metrics';
import { checkNonce, storeNonce } from '@/lib/security/nonce-store';
import { abuseDetectionService } from '@/lib/security/abuse-detection';
import { requireSupabaseAdmin } from '@/lib/supabase/server';

const IDEMPOTENCY_TTL_HOURS = 24;

export async function POST(request: NextRequest) {
  const clientIP = getClientIp(request);

  try {
    const idempotencyKey = request.headers.get(BOOKING_IDEMPOTENCY_HEADER)?.trim();
    if (!idempotencyKey || idempotencyKey.length > 512) {
      return errorResponse(ERROR_MESSAGES.IDEMPOTENCY_KEY_REQUIRED, 400);
    }

    await bookingService.runLazyExpireIfNeeded();

    const rateLimitResponse = await bookingRateLimitEnhanced(request);
    if (rateLimitResponse) return rateLimitResponse;

    const supabase = requireSupabaseAdmin();

    // ----------------------------
    // IDEMPOTENCY CHECK
    // ----------------------------
    const { data: idemRow } = await supabase.rpc('get_idempotency_booking', {
      p_key: idempotencyKey,
    });

    const idemRows = Array.isArray(idemRow) ? idemRow : idemRow ? [idemRow] : [];
    const stored = idemRows[0] as { response_snapshot: unknown } | undefined;
    const snapshot = stored?.response_snapshot as { _in_progress?: string } | undefined;

    if (stored?.response_snapshot != null && snapshot?._in_progress !== 'true') {
      const response = NextResponse.json(stored.response_snapshot);
      setNoCacheHeaders(response);
      return response;
    }

    // ----------------------------
    // NONCE CHECK
    // ----------------------------
    const requestId = request.headers.get('x-request-id');
    if (requestId) {
      if (!isValidUUID(requestId)) {
        return errorResponse('Invalid request ID', 400);
      }

      const user = await getServerUser(request);
      const nonceExists = await checkNonce(requestId);
      if (nonceExists) return errorResponse('Duplicate request', 409);

      await storeNonce(requestId, user?.id, clientIP);
    }

    // ----------------------------
    // BODY VALIDATION
    // ----------------------------
    const body = await request.json();
    const { filterFields, validateStringLength } = await import('@/lib/security/input-filter');

    const allowedFields = ['salon_id', 'slot_id', 'customer_name', 'customer_phone', 'service_ids'];

    const filteredBody = filterFields(body, allowedFields as (keyof typeof body)[]);
    const validatedData = validateCreateBooking(filteredBody);

    if (!isValidUUID(validatedData.salon_id) || !isValidUUID(validatedData.slot_id)) {
      return errorResponse('Invalid salon or slot ID', 400);
    }

    if (!validateStringLength(validatedData.customer_name, 200)) {
      return errorResponse('Customer name too long', 400);
    }

    if (!validateStringLength(validatedData.customer_phone, 20)) {
      return errorResponse('Customer phone too long', 400);
    }

    // ----------------------------
    // SLOT FETCH
    // ----------------------------
    const slot = await slotService.getSlotById(validatedData.slot_id);
    if (!slot) return errorResponse(ERROR_MESSAGES.SLOT_NOT_FOUND, 404);

    if (slot.business_id !== validatedData.salon_id) {
      return errorResponse('Slot does not belong to this salon', 400);
    }

    // ----------------------------
    // BUSINESS HOURS VALIDATION
    // ----------------------------
    const validation = await businessHoursService.validateSlot(
      validatedData.salon_id,
      slot.date,
      slot.start_time,
      slot.end_time
    );

    if (!validation.valid) {
      return errorResponse(validation.reason || 'Invalid slot', 400);
    }

    // ----------------------------
    // ABUSE CHECK
    // ----------------------------
    const user = await getServerUser(request);
    const customerUserId = user?.id;

    const abuseCheck = await abuseDetectionService.shouldBlockAction(
      customerUserId || null,
      clientIP,
      'booking'
    );

    if (abuseCheck.blocked) {
      return errorResponse(abuseCheck.reason || 'Action blocked', 429);
    }

    // ----------------------------
    // CREATE BOOKING
    // ----------------------------
    const serviceIds = Array.isArray(filteredBody.service_ids)
      ? filteredBody.service_ids
      : undefined;

    const params = await bookingService.prepareCreateBookingParams(
      validatedData,
      customerUserId,
      serviceIds
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

    if (idemError) throw new Error(idemError.message);

    const row = Array.isArray(idemResult) ? idemResult[0] : idemResult;
    const createdBookingId = row?.booking_id;
    if (!createdBookingId) throw new Error(ERROR_MESSAGES.DATABASE_ERROR);

    const booking = await bookingService.getBookingByUuidWithDetails(createdBookingId);
    if (!booking) throw new Error(ERROR_MESSAGES.DATABASE_ERROR);

    const salon = await salonService.getSalonById(validatedData.salon_id);
    if (!salon) throw new Error(ERROR_MESSAGES.SALON_NOT_FOUND);

    const bookingWithDetails: BookingWithDetails = {
      ...booking,
      salon,
      slot,
    };

    await emitBookingCreated(bookingWithDetails);
    await metricsService.increment(METRICS_BOOKING_CREATED);
    await reminderService.scheduleBookingReminders(booking.id);

    const whatsapp = whatsappService.generateBookingRequestMessage(
      bookingWithDetails,
      salon,
      request
    );

    const bookingStatusUrl = getBookingStatusUrl(booking.booking_id, request);

    const responsePayload = {
      data: {
        booking,
        whatsapp_url: whatsapp.whatsappUrl,
        message: whatsapp.message,
        booking_status_url: bookingStatusUrl,
      },
      message: SUCCESS_MESSAGES.BOOKING_CREATED,
    };

    await supabase.rpc('set_idempotency_booking_result', {
      p_key: idempotencyKey,
      p_result_id: booking.id,
      p_response_snapshot: responsePayload,
    });

    const response = successResponse(responsePayload.data, responsePayload.message);
    setNoCacheHeaders(response);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;

    return errorResponse(message, 400);
  }
}
