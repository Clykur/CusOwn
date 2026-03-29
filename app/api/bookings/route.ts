import { NextRequest, NextResponse } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { whatsappService } from '@/services/whatsapp.service';
import { salonService } from '@/services/salon.service';
import { slotService } from '@/services/slot.service';
import { reminderService } from '@/services/reminder.service';
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
  METRICS_BOOKING_CREATED,
  METRICS_BOOKING_CONFLICT_TOTAL,
  METRICS_OBSERVABILITY_BOOKING_ATTEMPT_TOTAL,
  METRICS_OBSERVABILITY_SLOT_CONFLICT_TOTAL,
} from '@/config/constants';
import { BookingWithDetails } from '@/types';
import { emitBookingCreated } from '@/lib/events/booking-events';
import { safeMetrics } from '@/lib/monitoring/safe-metrics';
import { checkNonce, storeNonce } from '@/lib/security/nonce-store';
import { abuseDetectionService } from '@/lib/security/abuse-detection';
import { recordIpUserSighting, computeAndStoreRisk } from '@/services/fraud.service';
import { hashIp } from '@/lib/fraud/ip-hash';
import { logStructured } from '@/lib/observability/structured-log';
import { requireSupabaseAdmin } from '@/lib/supabase/server';

const IDEMPOTENCY_TTL_HOURS = 24;

export async function POST(request: NextRequest) {
  const clientIP = getClientIp(request);

  try {
    // ----------------------------
    // HEADER FIX (robust for Vitest)
    // ----------------------------
    const headerMap: Record<string, string> = {};
    request.headers.forEach((value, key) => {
      headerMap[key.toLowerCase()] = value;
    });

    const idempotencyKey = headerMap['x-idempotency-key'] || headerMap['idempotency-key'];

    if (!idempotencyKey || idempotencyKey.trim().length === 0 || idempotencyKey.length > 512) {
      return errorResponse(ERROR_MESSAGES.IDEMPOTENCY_KEY_REQUIRED, 400);
    }

    await bookingService.runLazyExpireIfNeeded();

    const rateLimitResponse = await bookingRateLimitEnhanced(request);
    if (rateLimitResponse) return rateLimitResponse;

    // ----------------------------
    // NONCE CHECK
    // ----------------------------
    const requestId = request.headers.get('x-request-id');
    const serverUser = await getServerUser(request);
    const customerUserId = serverUser?.id || null;

    if (requestId) {
      if (!isValidUUID(requestId)) {
        return errorResponse('Invalid request ID', 400);
      }

      const nonceExists = await checkNonce(requestId);
      if (nonceExists) return errorResponse('Duplicate request', 409);

      await storeNonce(requestId, customerUserId, clientIP);
    }

    // ----------------------------
    // BODY VALIDATION
    // ----------------------------
    const body = await request.json();
    const date = body.date;

    const { filterFields, validateStringLength } = await import('@/lib/security/input-filter');

    const filteredBody = filterFields(body, [
      'salon_id',
      'slot_id',
      'customer_name',
      'customer_phone',
      'service_ids',
      'date',
    ] as (keyof typeof body)[]);

    const validatedData = validateCreateBooking(filteredBody);

    if (!isValidUUID(validatedData.salon_id)) {
      return errorResponse('Invalid salon ID', 400);
    }

    if (!validateStringLength(validatedData.customer_name, 200)) {
      return errorResponse('Customer name too long', 400);
    }

    if (!validateStringLength(validatedData.customer_phone, 20)) {
      return errorResponse('Customer phone too long', 400);
    }

    // ----------------------------
    // SALON CHECK
    // ----------------------------
    const salon = await salonService.getSalonById(validatedData.salon_id);
    if (!salon) return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);

    // ----------------------------
    // SLOT VALIDATION (CRITICAL FIX)
    // ----------------------------
    if (!validatedData.slot_id) {
      return errorResponse(ERROR_MESSAGES.SLOT_NOT_FOUND, 404);
    }

    const slotData = await slotService.getSlotById(validatedData.slot_id);

    if (!slotData) {
      return errorResponse(ERROR_MESSAGES.SLOT_NOT_FOUND, 404);
    }

    if (slotData.business_id !== validatedData.salon_id) {
      return errorResponse('Slot does not belong to salon', 400);
    }
    // ----------------------------
    // BUSINESS HOURS VALIDATION (FIXED)
    // ----------------------------
    const { businessHoursService } = await import('@/services/business-hours.service');

    const slotValidation = await businessHoursService.validateSlot(
      validatedData.salon_id,
      slotData.date,
      slotData.start_time,
      slotData.end_time
    );

    if (!slotValidation.valid) {
      return errorResponse(slotValidation.reason || 'Invalid slot', 400);
    }
    // ----------------------------
    // DATE CHECK
    // ----------------------------
    if (!date) {
      return errorResponse('Date required for booking', 400);
    }

    // ----------------------------
    // PREPARE PARAMS
    // ----------------------------
    const serviceIds = Array.isArray(filteredBody.service_ids) ? filteredBody.service_ids : [];

    const params = await bookingService.prepareCreateBookingParams(
      validatedData,
      customerUserId,
      serviceIds
    );

    // ----------------------------
    // ABUSE CHECK
    // ----------------------------
    const abuseCheck = await abuseDetectionService.shouldBlockAction(
      customerUserId,
      clientIP,
      'booking'
    );

    if (abuseCheck.blocked) {
      return errorResponse(abuseCheck.reason || 'Action blocked', 429);
    }

    // ----------------------------
    // NOW INIT SUPABASE (AFTER VALIDATION)
    // ----------------------------
    const supabase = requireSupabaseAdmin();

    // ----------------------------
    // CREATE BOOKING
    // ----------------------------
    const { data: result, error: rpcError } = await supabase.rpc('create_booking_service_aware', {
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
    });

    if (rpcError) throw rpcError;

    const row = Array.isArray(result) ? result[0] : result;

    if (!row?.booking_id) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    const booking = await bookingService.getBookingByUuidWithDetails(row.booking_id);
    if (!booking) throw new Error(ERROR_MESSAGES.DATABASE_ERROR);

    const slot = (await slotService.getSlotById(params.p_slot_id)) || undefined;

    const bookingWithDetails: BookingWithDetails = {
      ...booking,
      salon,
      slot,
    };

    await emitBookingCreated(bookingWithDetails);

    safeMetrics.increment(METRICS_BOOKING_CREATED, 1);
    safeMetrics.increment(METRICS_OBSERVABILITY_BOOKING_ATTEMPT_TOTAL, 1);

    if (serverUser?.id) {
      recordIpUserSighting(hashIp(clientIP), serverUser.id).catch(() => {});
      computeAndStoreRisk(serverUser.id).catch(() => {});
    }

    await reminderService.scheduleBookingReminders(booking.id);

    const whatsapp = whatsappService.generateBookingRequestMessage(
      bookingWithDetails,
      salon,
      request
    );

    const bookingStatusUrl = getBookingStatusUrl(booking.booking_id, request);

    const response = successResponse(
      {
        booking,
        whatsapp_url: whatsapp.whatsappUrl,
        message: whatsapp.message,
        booking_status_url: bookingStatusUrl,
      },
      SUCCESS_MESSAGES.BOOKING_CREATED
    );

    setNoCacheHeaders(response);

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;

    return errorResponse(message, 400);
  }
}
