import { NextRequest, NextResponse } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { whatsappService } from '@/services/whatsapp.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { setNoCacheHeaders } from '@/lib/cache/next-cache';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/config/constants';
import { getServerUser } from '@/lib/supabase/server-auth';
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

    const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    
    const body = await request.json().catch(() => ({}));
    
    // SECURITY: Filter input to prevent mass assignment
    const { filterFields, validateStringLength } = await import('@/lib/security/input-filter');
    const allowedFields: (keyof typeof body)[] = ['reason', 'cancelled_by'];
    const filteredBody = filterFields(body, allowedFields);
    
    const { reason, cancelled_by } = filteredBody;
    
    // SECURITY: Validate cancelled_by enum
    if (cancelled_by !== undefined && cancelled_by !== 'customer' && cancelled_by !== 'owner') {
      console.warn(`[SECURITY] Invalid cancelled_by value from IP: ${clientIP}`);
      return errorResponse('Invalid cancellation type', 400);
    }
    
    // SECURITY: Validate reason length
    if (reason !== undefined && !validateStringLength(reason, 500)) {
      return errorResponse('Cancellation reason is too long', 400);
    }

    const booking = await bookingService.getBookingByUuid(id);
    if (!booking) {
      console.warn(`[SECURITY] Booking not found for cancellation from IP: ${clientIP}, Booking: ${id.substring(0, 8)}...`);
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const user = await getServerUser(request);
    
    // Authorization: Verify user has permission to cancel
    let isAuthorized = false;
    let cancelMethod: 'customer' | 'owner' = 'customer';
    
    if (cancelled_by === 'owner') {
      // Owner cancellation requires ownership verification
      if (!user) {
        console.warn(`[SECURITY] Unauthenticated owner cancellation attempt from IP: ${clientIP}, Booking: ${id.substring(0, 8)}...`);
        return errorResponse('Authentication required', 401);
      }
      
      const { userService } = await import('@/services/user.service');
      const userBusinesses = await userService.getUserBusinesses(user.id);
      const hasAccess = userBusinesses.some(b => b.id === booking.business_id);
      
      if (!hasAccess) {
        const profile = await userService.getUserProfile(user.id);
        const isAdmin = profile?.user_type === 'admin';
        if (!isAdmin) {
          console.warn(`[SECURITY] Unauthorized owner cancellation attempt from IP: ${clientIP}, User: ${user.id.substring(0, 8)}..., Booking: ${id.substring(0, 8)}...`);
          return errorResponse('Access denied', 403);
        }
      }
      
      isAuthorized = true;
      cancelMethod = 'owner';
    } else {
      // Customer cancellation requires customer verification
      if (user) {
        const isCustomer = booking.customer_user_id === user.id;
        if (isCustomer) {
          isAuthorized = true;
          cancelMethod = 'customer';
        } else {
          console.warn(`[SECURITY] Unauthorized customer cancellation attempt from IP: ${clientIP}, User: ${user.id.substring(0, 8)}..., Booking: ${id.substring(0, 8)}...`);
          return errorResponse('Access denied', 403);
        }
      } else {
        // For unauthenticated users, only allow if booking has no customer_user_id (legacy)
        if (!booking.customer_user_id) {
          isAuthorized = true;
          cancelMethod = 'customer';
        } else {
          console.warn(`[SECURITY] Unauthenticated cancellation attempt for authenticated booking from IP: ${clientIP}, Booking: ${id.substring(0, 8)}...`);
          return errorResponse('Authentication required', 401);
        }
      }
    }

    if (!isAuthorized) {
      return errorResponse('Access denied', 403);
    }

    let cancelledBooking;
    if (cancelMethod === 'owner') {
      cancelledBooking = await bookingService.cancelBookingByOwner(id, reason);
    } else {
      cancelledBooking = await bookingService.cancelBookingByCustomer(id, reason);
    }
    
    // SECURITY: Log mutation for audit
    if (user) {
      try {
        await auditService.createAuditLog(
          user.id,
          'booking_cancelled',
          'booking',
          {
            entityId: id,
            description: `Booking cancelled by ${cancelMethod}${reason ? `: ${reason}` : ''}`,
            request,
          }
        );
      } catch (auditError) {
        // Log audit error but don't fail the request
        console.error('[SECURITY] Failed to create audit log:', auditError);
      }
    }
    
    console.log(`[SECURITY] Booking cancelled: IP: ${clientIP}, Booking: ${id.substring(0, 8)}..., Method: ${cancelMethod}, User: ${user?.id.substring(0, 8) || 'unauthenticated'}...`);

    const bookingWithDetails = await bookingService.getBookingByUuidWithDetails(id);
    if (!bookingWithDetails || !bookingWithDetails.salon) {
      return successResponse(cancelledBooking, SUCCESS_MESSAGES.BOOKING_CANCELLED);
    }

    const message = `❌ *BOOKING CANCELLED*\n\nDear *${bookingWithDetails.customer_name}*,\n\nYour booking has been cancelled.\n\nBooking ID: ${bookingWithDetails.booking_id}\n${reason ? `Reason: ${reason}` : ''}\n\nPlease book a new slot if needed.`;
    const whatsappUrl = whatsappService.getWhatsAppUrl(bookingWithDetails.customer_phone, message);

    const response = successResponse(
      {
        ...cancelledBooking,
        whatsapp_url: whatsappUrl,
      },
      SUCCESS_MESSAGES.BOOKING_CANCELLED
    );
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 400);
  }
}
