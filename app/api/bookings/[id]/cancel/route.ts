import { NextRequest } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { whatsappService } from '@/services/whatsapp.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getClientIp, isValidUUID } from '@/lib/utils/security';
import { setNoCacheHeaders } from '@/lib/cache/next-cache';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/config/constants';
import { getAuthContext } from '@/lib/utils/api-auth-pipeline';
import { userService } from '@/services/user.service';
import { auditService } from '@/services/audit.service';
import { isAdminProfile } from '@/lib/utils/role-verification';
import { logAuthDeny } from '@/lib/monitoring/auth-audit';

const ROUTE = 'POST /api/bookings/[id]/cancel';

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await bookingService.runLazyExpireIfNeeded();

    const { id } = params;
    if (!id || !isValidUUID(id)) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const clientIP = getClientIp(request);

    const body = await request.json().catch(() => ({}));

    const { filterFields, validateStringLength } = await import('@/lib/security/input-filter');
    const allowedFields: (keyof typeof body)[] = ['reason', 'cancelled_by'];
    const filteredBody = filterFields(body, allowedFields);

    const { reason, cancelled_by } = filteredBody;

    if (cancelled_by !== undefined && cancelled_by !== 'customer' && cancelled_by !== 'owner') {
      return errorResponse('Invalid cancellation type', 400);
    }

    if (reason !== undefined && !validateStringLength(reason, 500)) {
      return errorResponse('Cancellation reason is too long', 400);
    }

    const booking = await bookingService.getBookingByUuid(id);
    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const ctx = await getAuthContext(request);
    const user = ctx?.user ?? null;

    let isAuthorized = false;
    let cancelMethod: 'customer' | 'owner' = 'customer';

    if (cancelled_by === 'owner') {
      if (!user) {
        logAuthDeny({ route: ROUTE, reason: 'auth_missing', resource: id });
        return errorResponse('Authentication required', 401);
      }
      const userBusinesses = await userService.getUserBusinesses(user.id);
      const hasAccess = userBusinesses.some((b) => b.id === booking.business_id);
      if (!hasAccess && !isAdminProfile(ctx!.profile)) {
        logAuthDeny({
          user_id: user.id,
          route: ROUTE,
          reason: 'auth_denied',
          role: (ctx!.profile as any)?.user_type ?? 'unknown',
          resource: id,
        });
        return errorResponse('Access denied', 403);
      }
      isAuthorized = true;
      cancelMethod = 'owner';
    } else {
      if (user) {
        const isCustomer = booking.customer_user_id === user.id;
        if (isCustomer) {
          isAuthorized = true;
          cancelMethod = 'customer';
        } else {
          logAuthDeny({
            user_id: user.id,
            route: ROUTE,
            reason: 'auth_denied',
            resource: id,
          });
          return errorResponse('Access denied', 403);
        }
      } else {
        if (!booking.customer_user_id) {
          isAuthorized = true;
          cancelMethod = 'customer';
        } else {
          logAuthDeny({ route: ROUTE, reason: 'auth_missing', resource: id });
          return errorResponse('Authentication required', 401);
        }
      }
    }

    if (!isAuthorized) {
      return errorResponse('Access denied', 403);
    }

    // Idempotency: already cancelled → return 200 with current state (same result as success)
    if (booking.status === 'cancelled') {
      const response = successResponse(booking, SUCCESS_MESSAGES.BOOKING_CANCELLED);
      setNoCacheHeaders(response);
      return response;
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
        await auditService.createAuditLog(user.id, 'booking_cancelled', 'booking', {
          entityId: id,
          description: `Booking cancelled by ${cancelMethod}${reason ? `: ${reason}` : ''}`,
          request,
        });
      } catch (auditError) {
        // Log audit error but don't fail the request
        console.error('[SECURITY] Failed to create audit log:', auditError);
      }
    }

    console.log(
      `[SECURITY] Booking cancelled: IP: ${clientIP}, Booking: ${id.substring(0, 8)}..., Method: ${cancelMethod}, User: ${user?.id.substring(0, 8) || 'unauthenticated'}...`
    );

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
