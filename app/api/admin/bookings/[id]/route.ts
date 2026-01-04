import { NextRequest } from 'next/server';
import { getServerUser } from '@/lib/supabase/server-auth';
import { checkIsAdminServer } from '@/lib/utils/admin';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { auditService } from '@/services/audit.service';
import { adminNotificationService } from '@/services/admin-notification.service';
import { whatsappService } from '@/services/whatsapp.service';
import { slotService } from '@/services/slot.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { ERROR_MESSAGES, BOOKING_STATUS } from '@/config/constants';
import { formatDate, formatTime } from '@/lib/utils/string';

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const isAdmin = await checkIsAdminServer(user.id);
    if (!isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    const supabase = requireSupabaseAdmin();
    const body = await request.json();

    // Get old booking data
    const { data: oldBooking } = await supabase
      .from('bookings')
      .select(`
        *,
        business:business_id (*),
        slot:slot_id (*)
      `)
      .eq('id', params.id)
      .single();

    if (!oldBooking) {
      return errorResponse('Booking not found', 404);
    }

    // Prepare update data
    const updateData: any = {};
    if (body.status !== undefined) {
      updateData.status = body.status;
    }
    if (body.customer_name !== undefined) updateData.customer_name = body.customer_name;
    if (body.customer_phone !== undefined) updateData.customer_phone = body.customer_phone;

    const { data: updatedBooking, error } = await supabase
      .from('bookings')
      .update(updateData)
      .eq('id', params.id)
      .select(`
        *,
        business:business_id (*),
        slot:slot_id (*)
      `)
      .single();

    if (error) {
      return errorResponse(error.message || ERROR_MESSAGES.DATABASE_ERROR, 500);
    }

    // Handle slot status if booking status changed
    if (body.status && body.status !== oldBooking.status) {
      if (body.status === BOOKING_STATUS.CONFIRMED && oldBooking.status === BOOKING_STATUS.PENDING) {
        // Mark slot as booked
        await slotService.updateSlotStatus(oldBooking.slot_id, 'booked');
      } else if (body.status === BOOKING_STATUS.REJECTED || body.status === BOOKING_STATUS.CANCELLED) {
        // Release slot if rejected or cancelled
        await slotService.updateSlotStatus(oldBooking.slot_id, 'available');
      }
    }

    // Create audit log
    const changes: string[] = [];
    Object.keys(updateData).forEach(key => {
      if (oldBooking[key] !== updateData[key]) {
        changes.push(`${key}: ${oldBooking[key]} → ${updateData[key]}`);
      }
    });

    await auditService.createAuditLog(
      user.id,
      'booking_updated',
      'booking',
      {
        entityId: params.id,
        oldData: oldBooking,
        newData: updatedBooking,
        description: `Booking updated: ${changes.join(', ')}`,
        request,
      }
    );

    // Send notification to customer if status changed
    if (body.status && body.status !== oldBooking.status && updatedBooking.slot && updatedBooking.business) {
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
        // Return WhatsApp URL in response so admin can send it
        return successResponse({ ...updatedBooking, whatsapp_url: await whatsappUrl }, 'Booking updated and notification prepared');
      } catch {
        // Continue even if notification fails
      }
    }

    return successResponse(updatedBooking, 'Booking updated successfully');
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const isAdmin = await checkIsAdminServer(user.id);
    if (!isAdmin) {
      return errorResponse('Admin access required', 403);
    }

    const body = await request.json();
    const action = body.action; // 'resend_notification'

    if (action === 'resend_notification') {
      const supabase = requireSupabaseAdmin();
      
      const { data: booking } = await supabase
        .from('bookings')
        .select(`
          *,
          business:business_id (*),
          slot:slot_id (*)
        `)
        .eq('id', params.id)
        .single();

      if (!booking || !booking.slot || !booking.business) {
        return errorResponse('Booking not found or incomplete', 404);
      }

      let whatsappUrl: string;
      
      if (booking.status === BOOKING_STATUS.CONFIRMED) {
        whatsappUrl = whatsappService.getConfirmationWhatsAppUrl(booking, booking.business, request);
      } else if (booking.status === BOOKING_STATUS.REJECTED) {
        whatsappUrl = whatsappService.getRejectionWhatsAppUrl(booking, booking.business, request);
      } else {
        return errorResponse('Cannot resend notification for this booking status', 400);
      }

      // Create audit log
      await auditService.createAuditLog(
        user.id,
        'notification_sent',
        'booking',
        {
          entityId: params.id,
          description: `Notification resent for booking ${params.id}`,
          request,
        }
      );

      return successResponse({ whatsapp_url: whatsappUrl }, 'Notification prepared');
    }

    return errorResponse('Invalid action', 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

