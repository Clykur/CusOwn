import { NextRequest } from 'next/server';
import { requireAdmin } from '@/lib/utils/api-auth-pipeline';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { auditService } from '@/services/audit.service';
import { adminNotificationService } from '@/services/admin-notification.service';
import { whatsappService } from '@/services/whatsapp.service';
import { slotService } from '@/services/slot.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES, BOOKING_STATUS } from '@/config/constants';
import { formatDate, formatTime } from '@/lib/utils/string';
import { invalidateApiCacheByPrefix } from '@/lib/cache/api-response-cache';

const ROUTE_GET = 'GET /api/admin/bookings/[id]';
const ROUTE_PATCH = 'PATCH /api/admin/bookings/[id]';
const ROUTE_POST = 'POST /api/admin/bookings/[id]';

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(request, ROUTE_GET);
    if (auth instanceof Response) return auth;

    const supabase = requireSupabaseAdmin();

    const { data: booking, error } = await supabase
      .from('bookings')
      .select(
        `
        *,
        business:business_id (*),
        slot:slot_id (*)
      `
      )
      .eq('id', params.id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return errorResponse('Booking not found', 404);
      }
      return errorResponse(error.message || ERROR_MESSAGES.DATABASE_ERROR, 500);
    }

    if (!booking) {
      return errorResponse('Booking not found', 404);
    }

    return successResponse(booking);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(request, ROUTE_PATCH);
    if (auth instanceof Response) return auth;

    const supabase = requireSupabaseAdmin();
    const body = await request.json();

    // SECURITY: Filter input to prevent mass assignment
    const { filterBookingUpdateFields, validateStringLength, validateEnum } =
      await import('@/lib/security/input-filter');
    const filteredBody = filterBookingUpdateFields(body);

    // SECURITY: Validate enum values
    if (filteredBody.status !== undefined) {
      const validStatuses = ['pending', 'confirmed', 'rejected', 'cancelled'] as const;
      if (!validateEnum(filteredBody.status, validStatuses)) {
        return errorResponse('Invalid booking status', 400);
      }
    }

    // SECURITY: Validate string lengths
    if (filteredBody.customer_name && !validateStringLength(filteredBody.customer_name, 200)) {
      return errorResponse('Customer name is too long', 400);
    }
    if (filteredBody.customer_phone && !validateStringLength(filteredBody.customer_phone, 20)) {
      return errorResponse('Customer phone is too long', 400);
    }
    if (
      filteredBody.cancellation_reason &&
      !validateStringLength(filteredBody.cancellation_reason, 500)
    ) {
      return errorResponse('Cancellation reason is too long', 400);
    }

    // Get old booking data
    const { data: oldBooking } = await supabase
      .from('bookings')
      .select(
        `
        *,
        business:business_id (*),
        slot:slot_id (*)
      `
      )
      .eq('id', params.id)
      .single();

    if (!oldBooking) {
      return errorResponse('Booking not found', 404);
    }

    // Prepare update data from filtered input only
    const updateData: any = {};
    if (filteredBody.status !== undefined) {
      updateData.status = filteredBody.status;
    }
    if (filteredBody.customer_name !== undefined)
      updateData.customer_name = filteredBody.customer_name;
    if (filteredBody.customer_phone !== undefined) {
      const { formatPhoneNumber } = await import('@/lib/utils/string');
      updateData.customer_phone = formatPhoneNumber(filteredBody.customer_phone);
    }

    const { data: updatedBooking, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', params.id)
      .select(
        `
        *,
        business:business_id (*),
        slot:slot_id (*)
      `
      )
      .single();

    if (error) {
      return errorResponse(error.message || ERROR_MESSAGES.DATABASE_ERROR, 500);
    }

    // Handle slot status if booking status changed
    if (body.status && body.status !== oldBooking.status) {
      if (
        body.status === BOOKING_STATUS.CONFIRMED &&
        oldBooking.status === BOOKING_STATUS.PENDING
      ) {
        // Mark slot as booked
        await slotService.updateSlotStatus(oldBooking.slot_id, 'booked');
      } else if (
        body.status === BOOKING_STATUS.REJECTED ||
        body.status === BOOKING_STATUS.CANCELLED
      ) {
        // Release slot if rejected or cancelled
        await slotService.updateSlotStatus(oldBooking.slot_id, 'available');
      }
    }

    // Create audit log
    const changes: string[] = [];
    Object.keys(updateData).forEach((key) => {
      if (oldBooking[key] !== updateData[key]) {
        changes.push(`${key}: ${oldBooking[key]} → ${updateData[key]}`);
      }
    });

    await auditService.createAuditLog(auth.user.id, 'booking_updated', 'booking', {
      entityId: params.id,
      oldData: oldBooking,
      newData: updatedBooking,
      description: `Booking updated: ${changes.join(', ')}`,
      request,
    });

    // Send notification to customer if status changed
    if (
      body.status &&
      body.status !== oldBooking.status &&
      updatedBooking.slot &&
      updatedBooking.business
    ) {
      try {
        const date = formatDate(updatedBooking.slot.date);
        const time = `${formatTime(updatedBooking.slot.start_time)} - ${formatTime(updatedBooking.slot.end_time)}`;

        const message = adminNotificationService.generateBookingUpdateMessage(
          updatedBooking.customer_name,
          updatedBooking.business.salon_name,
          date,
          time,
          body.status,
          body.reason,
          request
        );

        const whatsappUrl = adminNotificationService.notifyCustomer(params.id, message, request);
        invalidateApiCacheByPrefix('GET|/api/admin/bookings');
        invalidateApiCacheByPrefix('GET|/api/admin/metrics');
        return successResponse(
          { ...updatedBooking, whatsapp_url: await whatsappUrl },
          'Booking updated and notification prepared'
        );
      } catch {
        // Continue even if notification fails
      }
    }

    invalidateApiCacheByPrefix('GET|/api/admin/bookings');
    invalidateApiCacheByPrefix('GET|/api/admin/metrics');
    return successResponse(updatedBooking, 'Booking updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin(request, ROUTE_POST);
    if (auth instanceof Response) return auth;

    const body = await request.json();
    const action = body.action; // 'resend_notification'

    if (action === 'resend_notification') {
      const supabase = requireSupabaseAdmin();

      const { data: booking } = await supabase
        .from('bookings')
        .select(
          `
          *,
          business:business_id (*),
          slot:slot_id (*)
        `
        )
        .eq('id', params.id)
        .single();

      if (!booking || !booking.slot || !booking.business) {
        return errorResponse('Booking not found or incomplete', 404);
      }

      let whatsappUrl: string;

      if (booking.status === BOOKING_STATUS.CONFIRMED) {
        whatsappUrl = whatsappService.getConfirmationWhatsAppUrl(
          booking,
          booking.business,
          request
        );
      } else if (booking.status === BOOKING_STATUS.REJECTED) {
        whatsappUrl = whatsappService.getRejectionWhatsAppUrl(booking, booking.business, request);
      } else {
        return errorResponse('Cannot resend notification for this booking status', 400);
      }

      // Create audit log
      await auditService.createAuditLog(auth.user.id, 'notification_sent', 'booking', {
        entityId: params.id,
        description: `Notification resent for booking ${params.id}`,
        request,
      });

      return successResponse({ whatsapp_url: whatsappUrl }, 'Notification prepared');
    }

    return errorResponse('Invalid action', 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
