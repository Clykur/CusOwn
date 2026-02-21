import { NextRequest } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { whatsappService } from '@/services/whatsapp.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getClientIp, isValidUUID, validateResourceToken } from '@/lib/utils/security';
import { setNoCacheHeaders } from '@/lib/cache/next-cache';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/config/constants';
import { getAuthContext, denyInvalidToken } from '@/lib/utils/api-auth-pipeline';
import { userService } from '@/services/user.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { auditService } from '@/services/audit.service';
import { hasPermission, PERMISSIONS } from '@/services/permission.service';
import { logAuthDeny } from '@/lib/monitoring/auth-audit';

const rejectRateLimit = enhancedRateLimit({
  maxRequests: 10,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'booking_reject',
});
const ROUTE = 'POST /api/bookings/[id]/reject';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientIP = getClientIp(request);

  try {
    await bookingService.runLazyExpireIfNeeded();

    const rateLimitResponse = await rejectRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    if (!id || !isValidUUID(id)) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const token = request.nextUrl.searchParams.get('token');
    if (token) {
      const decodedToken = (() => {
        try {
          return decodeURIComponent(token);
        } catch {
          return token;
        }
      })();
      if (!validateResourceToken('reject', id, decodedToken)) {
        return denyInvalidToken(request, ROUTE, id);
      }
    }

    const booking = await bookingService.getBookingByUuidWithDetails(id);
    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const ctx = await getAuthContext(request);
    if (ctx) {
      const canReject = await hasPermission(ctx.user.id, PERMISSIONS.BOOKINGS_REJECT);
      if (!canReject) {
        logAuthDeny({
          user_id: ctx.user.id,
          route: ROUTE,
          reason: 'auth_denied',
          permission: PERMISSIONS.BOOKINGS_REJECT,
          resource: id,
        });
        return errorResponse('Access denied', 403);
      }
      const isAdmin = await hasPermission(ctx.user.id, PERMISSIONS.ADMIN_ACCESS);
      const userBusinesses = await userService.getUserBusinesses(ctx.user.id);
      const ownsBusiness = userBusinesses.some((b) => b.id === booking.business_id);
      if (!ownsBusiness && !isAdmin) {
        logAuthDeny({
          user_id: ctx.user.id,
          route: ROUTE,
          reason: 'auth_denied',
          resource: id,
        });
        return errorResponse('Access denied', 403);
      }
    } else if (!token) {
      logAuthDeny({ route: ROUTE, reason: 'auth_missing', resource: id });
      return errorResponse('Authentication required', 401);
    }

    const user = ctx?.user ?? null;

    // Idempotency: already rejected → return 200 with current state (same result as success)
    if (booking.status === 'rejected') {
      const whatsappUrl = booking.salon
        ? whatsappService.getRejectionWhatsAppUrl(booking, booking.salon, request)
        : undefined;
      const payload = whatsappUrl ? { ...booking, whatsapp_url: whatsappUrl } : booking;
      const response = successResponse(payload, SUCCESS_MESSAGES.BOOKING_REJECTED);
      setNoCacheHeaders(response);
      return response;
    }
    if (booking.status === 'confirmed') {
      return errorResponse(ERROR_MESSAGES.BOOKING_ALREADY_CONFIRMED, 409);
    }
    if (booking.status === 'cancelled') {
      return errorResponse(ERROR_MESSAGES.BOOKING_ALREADY_CANCELLED, 409);
    }

    const rejectedBooking = await bookingService.rejectBooking(id, ctx?.user?.id);
    const bookingWithDetails = await bookingService.getBookingByUuidWithDetails(id);

    if (!bookingWithDetails || !bookingWithDetails.salon || !bookingWithDetails.slot) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    const whatsappUrl = whatsappService.getRejectionWhatsAppUrl(
      bookingWithDetails,
      bookingWithDetails.salon,
      request
    );

    // SECURITY: Log mutation for audit
    if (user) {
      try {
        await auditService.createAuditLog(user.id, 'booking_rejected', 'booking', {
          entityId: id,
          description: 'Booking rejected by owner',
          request,
        });
      } catch (auditError) {
        console.error('[SECURITY] Failed to create audit log:', auditError);
      }
    }

    console.log(
      `[SECURITY] Booking rejected: IP: ${clientIP}, Booking: ${id.substring(0, 8)}..., User: ${user?.id.substring(0, 8) || 'token-based'}...`
    );

    const response = successResponse(
      {
        ...rejectedBooking,
        whatsapp_url: whatsappUrl,
      },
      SUCCESS_MESSAGES.BOOKING_REJECTED
    );
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 400);
  }
}
