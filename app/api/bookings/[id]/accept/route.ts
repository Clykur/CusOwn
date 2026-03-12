import { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { whatsappService } from '@/services/whatsapp.service';
import { reminderService } from '@/services/reminder.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getClientIp, isValidUUID } from '@/lib/utils/security';
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
import { isAdminProfile } from '@/lib/utils/role-verification';
import { logAuthDeny } from '@/lib/monitoring/auth-audit';
import { logStructured } from '@/lib/observability/structured-log';

const acceptRateLimit = enhancedRateLimit({
  maxRequests: 10,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'booking_accept',
});
const ROUTE = 'POST /api/bookings/[id]/accept';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientIP = getClientIp(request);

  try {
    await bookingService.runLazyExpireIfNeeded();

    const rateLimitResponse = await acceptRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    if (!id || !isValidUUID(id)) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const token = request.nextUrl.searchParams.get('token');
    let decodedToken: string | null = null;
    if (token) {
      decodedToken = (() => {
        try {
          return decodeURIComponent(token);
        } catch {
          return token;
        }
      })();
      const linkValidation = await validateOwnerActionLink('accept', id, decodedToken);
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
    }

    const booking = await bookingService.getBookingByUuidWithDetails(id);
    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const ctx = await getAuthContext(request);
    if (ctx) {
      const userBusinesses = await userService.getUserBusinesses(ctx.user.id);
      const ownsBusiness = userBusinesses.some((b) => b.id === booking.business_id);
      if (!ownsBusiness && !isAdminProfile(ctx.profile)) {
        logAuthDeny({
          user_id: ctx.user.id,
          route: ROUTE,
          reason: 'auth_denied',
          role: (ctx.profile as any)?.user_type ?? 'unknown',
          resource: id,
        });
        return errorResponse('Access denied', 403);
      }
    } else if (!token) {
      logAuthDeny({ route: ROUTE, reason: 'auth_missing', resource: id });
      return errorResponse('Authentication required', 401);
    }

    const user = ctx?.user ?? null;

    // Idempotency: already confirmed → return 200 with current state (same result as success)
    if (booking.status === 'confirmed') {
      const bookingWithDetails = await bookingService.getBookingByUuidWithDetails(id);
      if (bookingWithDetails?.salon?.address?.trim()) {
        const whatsappUrl = whatsappService.getConfirmationWhatsAppUrl(
          bookingWithDetails,
          bookingWithDetails.salon,
          request
        );
        const response = successResponse(
          { ...booking, whatsapp_url: whatsappUrl },
          SUCCESS_MESSAGES.BOOKING_CONFIRMED
        );
        setNoCacheHeaders(response);
        return response;
      }
      const response = successResponse(booking, SUCCESS_MESSAGES.BOOKING_CONFIRMED);
      setNoCacheHeaders(response);
      return response;
    }
    if (booking.status === 'rejected') {
      return errorResponse(ERROR_MESSAGES.BOOKING_ALREADY_REJECTED, 409);
    }
    if (booking.status === 'cancelled') {
      return errorResponse(ERROR_MESSAGES.BOOKING_ALREADY_CANCELLED, 409);
    }

    const confirmedBooking = await bookingService.confirmBooking(id, user?.id);
    if (decodedToken) {
      await recordOwnerActionLinkUsed(id, 'accept', decodedToken);
    }
    const bookingWithDetails = await bookingService.getBookingByUuidWithDetails(id);

    if (!bookingWithDetails || !bookingWithDetails.salon || !bookingWithDetails.slot) {
      throw new Error(ERROR_MESSAGES.BOOKING_NOT_FOUND);
    }

    const hasSalonAddress =
      !!bookingWithDetails.salon.address && bookingWithDetails.salon.address.trim() !== '';
    const whatsappUrl = hasSalonAddress
      ? whatsappService.getConfirmationWhatsAppUrl(
          bookingWithDetails,
          bookingWithDetails.salon,
          request
        )
      : undefined;

    await reminderService.scheduleBookingReminders(id);

    // SECURITY: Log mutation for audit
    if (user) {
      try {
        await auditService.createAuditLog(user.id, 'booking_confirmed', 'booking', {
          entityId: id,
          newData: { status: 'confirmed', business_id: booking.business_id },
          actorRole: ctx?.profile?.user_type ?? undefined,
          request,
        });
      } catch (auditError) {
        console.error('[SECURITY] Failed to create audit log:', auditError);
      }
    }

    logStructured('info', 'Booking accepted', {
      action: 'booking_accepted',
      booking_id: id,
    });

    invalidateBookingCache(id);
    const payload =
      whatsappUrl !== undefined
        ? { ...confirmedBooking, whatsapp_url: whatsappUrl }
        : confirmedBooking;
    const response = successResponse(payload, SUCCESS_MESSAGES.BOOKING_CONFIRMED);
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error(`[SECURITY] Accept booking error: IP: ${clientIP}, Error: ${message}`);
    const authCtx = await getAuthContext(request).catch(() => null);
    const { id: bookingId } = await params;
    try {
      await auditService.createAuditLog(authCtx?.user?.id ?? null, 'booking_confirmed', 'booking', {
        entityId: bookingId,
        status: 'failed',
        metadata: { error_message: message },
        request,
      });
    } catch (auditErr) {
      console.error('[SECURITY] Failed to create audit log for accept failure:', auditErr);
    }
    return errorResponse(message, 400);
  }
}
