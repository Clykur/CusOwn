import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { whatsappService } from '@/services/whatsapp.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { setNoCacheHeaders } from '@/lib/cache/next-cache';
import { invalidateBookingCache } from '@/lib/cache/api-response-cache';
import {
  SUCCESS_MESSAGES,
  ERROR_MESSAGES,
  UI_ERROR_CONTEXT,
  SECURE_LINK_RESPONSE_CODE,
} from '@/config/constants';
import { getAuthContext } from '@/lib/utils/api-auth-pipeline';
import {
  validateOwnerActionLink,
  recordOwnerActionLinkUsed,
} from '@/lib/utils/secure-link-validation.server';
import { userService } from '@/services/user.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { auditService } from '@/services/audit.service';
import { hasPermission, PERMISSIONS } from '@/services/permission.service';
import { logAuthDeny } from '@/lib/monitoring/auth-audit';
import { logStructured } from '@/lib/observability/structured-log';
import { canManageBookingForBusiness } from '@/lib/utils/booking-business-access.server';

const rejectRateLimit = enhancedRateLimit({
  maxRequests: 10,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'booking_reject',
});
const ROUTE = 'POST /api/bookings/[id]/reject';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await bookingService.runLazyExpireIfNeeded();

    const rateLimitResponse = await rejectRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    if (!id || !isValidUUID(id)) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const token = request.nextUrl.searchParams.get('token');

    let decodedToken: string | null = null;
    let tokenValid = false;

    if (token !== null) {
      // Basic input validation (prevents abuse + satisfies CodeQL)
      if (typeof token !== 'string' || token.length === 0 || token.length > 500) {
        logAuthDeny({
          route: ROUTE,
          reason: 'auth_invalid_token',
          resource: id,
        });

        return NextResponse.json(
          {
            success: false,
            error: UI_ERROR_CONTEXT.ACCEPT_REJECT_PAGE,
            code: SECURE_LINK_RESPONSE_CODE,
          },
          { status: 400 }
        );
      }

      // Safe decode
      try {
        decodedToken = decodeURIComponent(token);
      } catch {
        logAuthDeny({
          route: ROUTE,
          reason: 'auth_invalid_token',
          resource: id,
        });

        return NextResponse.json(
          {
            success: false,
            error: UI_ERROR_CONTEXT.ACCEPT_REJECT_PAGE,
            code: SECURE_LINK_RESPONSE_CODE,
          },
          { status: 400 }
        );
      }

      // Explicit validation (critical security check)
      const linkValidation = await validateOwnerActionLink('reject', id, decodedToken);

      if (!linkValidation.valid) {
        logAuthDeny({
          route: ROUTE,
          reason: 'auth_invalid_token',
          resource: id,
          audit_metadata: { link_validation_reason: linkValidation.reason },
        });

        return NextResponse.json(
          {
            success: false,
            error: UI_ERROR_CONTEXT.ACCEPT_REJECT_PAGE,
            code: SECURE_LINK_RESPONSE_CODE,
          },
          { status: 403 }
        );
      }
      tokenValid = true;
    }

    const booking = await bookingService.getBookingByUuidWithDetails(id);
    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const ctx = await getAuthContext(request);
    if (ctx) {
      const userBusinesses = await userService.getUserBusinesses(ctx.user.id);
      const ownsBusiness = userBusinesses.some((b) => b.id === booking.business_id);
      const asOwnerOrAdmin = await canManageBookingForBusiness(
        ctx.user.id,
        ctx.profile,
        booking.business_id
      );
      const withRejectPermission =
        (await hasPermission(ctx.user.id, PERMISSIONS.BOOKINGS_REJECT)) && ownsBusiness;
      if (!asOwnerOrAdmin && !withRejectPermission) {
        logAuthDeny({
          user_id: ctx.user.id,
          route: ROUTE,
          reason: 'auth_denied',
          resource: id,
        });
        return errorResponse('Access denied', 403);
      }
    } else if (!tokenValid) {
      logAuthDeny({ route: ROUTE, reason: 'auth_missing', resource: id });
      return errorResponse('Authentication required', 401);
    }

    const user = ctx?.user ?? null;

    // Idempotency: already rejected → return 200 with current state (same result as success)
    if (booking.status === 'rejected') {
      const whatsappUrl = booking.salon
        ? whatsappService.getRejectionWhatsAppUrl(booking, booking.salon, request)
        : undefined;
      invalidateBookingCache(id);
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
    if (decodedToken) {
      await recordOwnerActionLinkUsed(id, 'reject', decodedToken);
    }
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

    logStructured('info', 'Booking rejected', {
      action: 'booking_rejected',
      booking_id: id,
    });

    invalidateBookingCache(id);
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
