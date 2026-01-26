import { NextRequest, NextResponse } from 'next/server';
import { rescheduleService } from '@/services/reschedule.service';
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

    const body = await request.json();
    
    // SECURITY: Filter input to prevent mass assignment
    const { filterFields, validateStringLength, validateEnum } = await import('@/lib/security/input-filter');
    const allowedFields: (keyof typeof body)[] = ['new_slot_id', 'reason', 'rescheduled_by'];
    const filteredBody = filterFields(body, allowedFields);
    
    const { new_slot_id, reason, rescheduled_by } = filteredBody;

    if (!new_slot_id || !isValidUUID(new_slot_id)) {
      return errorResponse('Valid new slot ID is required', 400);
    }

    // SECURITY: Validate enum
    if (!rescheduled_by || !validateEnum(rescheduled_by, ['customer', 'owner'] as const)) {
      return errorResponse('rescheduled_by must be customer or owner', 400);
    }
    
    // SECURITY: Validate reason length
    if (reason !== undefined && !validateStringLength(reason, 500)) {
      return errorResponse('Reschedule reason is too long', 400);
    }

    const user = await getServerUser(request);
    const booking = await bookingService.getBookingByUuidWithDetails(id);

    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    if (rescheduled_by === 'customer' && (!user || booking.customer_user_id !== user.id)) {
      return errorResponse('Access denied', 403);
    }

    if (rescheduled_by === 'owner' && user) {
      const userBusinesses = await userService.getUserBusinesses(user.id);
      const hasAccess = userBusinesses.some(b => b.id === booking.business_id);
      if (!hasAccess) {
        return errorResponse('Access denied', 403);
      }
    }

    const rescheduledBooking = await rescheduleService.rescheduleBooking({
      bookingId: id,
      newSlotId: new_slot_id,
      rescheduledBy: rescheduled_by,
      reason: reason || undefined,
    });

    // SECURITY: Log mutation for audit
    if (user) {
      try {
        await auditService.createAuditLog(
          user.id,
          'booking_rescheduled',
          'booking',
          {
            entityId: id,
            description: `Booking rescheduled by ${rescheduled_by}${reason ? `: ${reason}` : ''}`,
            request,
          }
        );
      } catch (auditError) {
        console.error('[SECURITY] Failed to create audit log:', auditError);
      }
    }

    const bookingWithDetails = await bookingService.getBookingByUuidWithDetails(id);

    if (bookingWithDetails && bookingWithDetails.salon) {
      const message = `Your booking has been rescheduled. New date: ${bookingWithDetails.slot?.date}, Time: ${bookingWithDetails.slot?.start_time}`;
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

    const response = successResponse(rescheduledBooking);
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 400);
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;
    if (!id || !isValidUUID(id)) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const history = await rescheduleService.getRescheduleHistory(id);

    return successResponse(history);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
