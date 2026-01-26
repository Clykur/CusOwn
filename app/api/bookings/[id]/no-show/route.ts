import { NextRequest, NextResponse } from 'next/server';
import { noShowService } from '@/services/no-show.service';
import { bookingService } from '@/services/booking.service';
import { notificationService } from '@/services/notification.service';
import { userService } from '@/services/user.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { setNoCacheHeaders } from '@/lib/cache/next-cache';
import { getServerUser } from '@/lib/supabase/server-auth';
import { ERROR_MESSAGES } from '@/config/constants';
import { auditService } from '@/services/audit.service';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id || !isValidUUID(id)) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const booking = await bookingService.getBookingByUuidWithDetails(id);
    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const userBusinesses = await userService.getUserBusinesses(user.id);
    const hasAccess = userBusinesses.some(b => b.id === booking.business_id);

    if (!hasAccess) {
      return errorResponse('Access denied', 403);
    }

    const updatedBooking = await noShowService.markNoShow({
      bookingId: id,
      markedBy: 'owner',
    });

    // SECURITY: Log mutation for audit
    try {
      await auditService.createAuditLog(
        user.id,
        'booking_no_show',
        'booking',
        {
          entityId: id,
          description: 'Booking marked as no-show by owner',
          request,
        }
      );
    } catch (auditError) {
      console.error('[SECURITY] Failed to create audit log:', auditError);
    }

    if (booking.salon) {
      const message = `We noticed you didn't show up for your appointment on ${booking.slot?.date} at ${booking.slot?.start_time}. Please contact us to reschedule.`;
      try {
        await notificationService.sendBookingNotification(
          id,
          'whatsapp',
          message,
          booking.customer_phone
        );
      } catch {
      }
    }

    const response = successResponse(updatedBooking);
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 400);
  }
}
