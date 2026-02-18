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
import { SUCCESS_MESSAGES, ERROR_MESSAGES, SLOT_STATUS } from '@/config/constants';
import { BookingWithDetails } from '@/types';
import { auditService } from '@/services/audit.service';
import { checkNonce, storeNonce } from '@/lib/security/nonce-store';
import { abuseDetectionService } from '@/lib/security/abuse-detection';

export async function POST(request: NextRequest) {
  const clientIP = getClientIp(request);

  try {
    await bookingService.runLazyExpireIfNeeded();

    const rateLimitResponse = await bookingRateLimitEnhanced(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const requestId = request.headers.get('x-request-id');
    if (requestId) {
      if (!isValidUUID(requestId)) {
        return errorResponse('Invalid request ID', 400);
      }

      const user = await getServerUser(request);
      const nonceExists = await checkNonce(requestId);
      if (nonceExists) {
        return errorResponse('Duplicate request', 409);
      }

      await storeNonce(requestId, user?.id, clientIP);
    }

    const body = await request.json();

    const { filterFields, validateStringLength } = await import('@/lib/security/input-filter');
    const allowedFields: string[] = [
      'salon_id',
      'slot_id',
      'customer_name',
      'customer_phone',
      'service_ids',
    ];
    const filteredBody = filterFields(body, allowedFields as (keyof typeof body)[]);

    const validatedData = validateCreateBooking(filteredBody);

    if (!isValidUUID(validatedData.salon_id) || !isValidUUID(validatedData.slot_id)) {
      return errorResponse('Invalid salon or slot ID', 400);
    }

    // Additional length validation (defense in depth)
    if (!validateStringLength(validatedData.customer_name, 200)) {
      return errorResponse('Customer name is too long', 400);
    }
    if (!validateStringLength(validatedData.customer_phone, 20)) {
      return errorResponse('Customer phone is too long', 400);
    }

    const user = await getServerUser(request);
    const customerUserId = user?.id;

    const abuseCheck = await abuseDetectionService.shouldBlockAction(
      customerUserId || null,
      clientIP,
      'booking'
    );
    if (abuseCheck.blocked) {
      console.warn(
        `[ABUSE] Blocked booking attempt: ${abuseCheck.reason}, IP: ${clientIP}, User: ${customerUserId?.substring(0, 8) || 'anonymous'}...`
      );
      return errorResponse(abuseCheck.reason || 'Action blocked due to abuse detection', 429);
    }

    const serviceIds = Array.isArray(filteredBody.service_ids)
      ? filteredBody.service_ids
      : undefined;

    if (serviceIds) {
      if (serviceIds.length > 10) {
        return errorResponse('Too many services', 400);
      }
      for (const serviceId of serviceIds) {
        if (!isValidUUID(serviceId)) {
          return errorResponse('Invalid service ID', 400);
        }
      }
    }

    const booking = await bookingService.createBooking(validatedData, customerUserId, serviceIds);
    const salon = await salonService.getSalonById(validatedData.salon_id);

    if (!salon) {
      throw new Error(ERROR_MESSAGES.SALON_NOT_FOUND);
    }

    if (!salon.whatsapp_number) {
      throw new Error('Salon WhatsApp number is not configured. Please contact the salon owner.');
    }

    // Re-fetch slot to get updated status after reservation
    const updatedSlot = await slotService.getSlotById(validatedData.slot_id);

    if (!updatedSlot) {
      throw new Error(ERROR_MESSAGES.SLOT_NOT_FOUND);
    }

    if (updatedSlot.business_id !== validatedData.salon_id) {
      throw new Error('Slot does not belong to this salon');
    }

    const updatedSlotAfterBooking = await slotService.getSlotById(validatedData.slot_id);
    const bookingWithDetails: BookingWithDetails = {
      ...booking,
      salon,
      slot: updatedSlotAfterBooking || updatedSlot,
    };

    let whatsappUrl: string;
    let message: string;
    try {
      const result = whatsappService.generateBookingRequestMessage(
        bookingWithDetails,
        salon,
        request
      );
      whatsappUrl = result.whatsappUrl;
      message = result.message;
    } catch (whatsappError) {
      console.error('Error generating WhatsApp URL:', whatsappError);
      throw new Error('Failed to generate WhatsApp link. Please contact the salon directly.');
    }

    await reminderService.scheduleBookingReminders(booking.id);

    // SECURITY: Log mutation for audit (if user is authenticated)
    if (user) {
      try {
        await auditService.createAuditLog(user.id, 'booking_created', 'booking', {
          entityId: booking.id,
          description: `Booking created for ${validatedData.customer_name}`,
          request,
        });
      } catch (auditError) {
        console.error('[SECURITY] Failed to create audit log:', auditError);
      }
    }

    const bookingStatusUrl = getBookingStatusUrl(booking.booking_id, request);

    const response = successResponse(
      {
        booking,
        whatsapp_url: whatsappUrl,
        message,
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
