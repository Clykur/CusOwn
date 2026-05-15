import { NextRequest } from 'next/server';
import { bookingService } from '@cusown/shared/server';
import { successResponse, errorResponse } from '@cusown/shared/server';
import { getClientIp, isValidUUID } from '@cusown/shared/server';
import { setNoCacheHeaders } from '@cusown/shared/server';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@cusown/config';
import { getAuthContext } from '@cusown/shared/server';
import { enhancedRateLimit } from '@cusown/shared/server';
import { auditService } from '@cusown/shared/server';
import { logAuthDeny } from '@cusown/shared/server';
import { logStructured } from '@cusown/shared/server';
import { canManageBookingForBusiness } from '@cusown/shared/server';

const undoAcceptRateLimit = enhancedRateLimit({
  maxRequests: 10,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'booking_undo_accept',
});
const ROUTE = 'POST /api/bookings/[id]/undo-accept';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientIP = getClientIp(request);

  try {
    await bookingService.runLazyExpireIfNeeded();

    const rateLimitResponse = await undoAcceptRateLimit(request);
    if (rateLimitResponse) return rateLimitResponse;

    const { id } = await params;
    if (!id || !isValidUUID(id)) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const ctx = await getAuthContext(request);
    if (!ctx) {
      logAuthDeny({ route: ROUTE, reason: 'auth_missing', resource: id });
      return errorResponse(ERROR_MESSAGES.AUTHENTICATION_REQUIRED, 401);
    }

    const booking = await bookingService.getBookingByUuidWithDetails(id);
    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    if (!booking.salon) {
      return errorResponse(ERROR_MESSAGES.SALON_NOT_FOUND, 404);
    }

    const allowed = await canManageBookingForBusiness(
      ctx.user.id,
      ctx.profile,
      booking.business_id
    );
    if (!allowed) {
      logAuthDeny({
        user_id: ctx.user.id,
        route: ROUTE,
        reason: 'auth_denied',
        role: (ctx.profile as { user_type?: string })?.user_type ?? 'unknown',
        resource: id,
      });
      return errorResponse(ERROR_MESSAGES.BOOKING_MANAGE_ACCESS_DENIED, 403);
    }

    const updated = await bookingService.revertConfirmToPending(id, ctx.user.id);
    try {
      await auditService.createAuditLog(ctx.user.id, 'booking_undo_accept', 'booking', {
        entityId: id,
        description: 'Booking reverted to pending (undo accept)',
        oldData: { status: 'confirmed' },
        newData: { status: 'pending' },
        request,
      });
    } catch (auditError) {
      console.error('[SECURITY] Failed to create audit log:', auditError);
    }

    logStructured('info', 'Booking undo accept', {
      action: 'booking_undo_accept',
      booking_id: id,
    });

    const response = successResponse(updated, SUCCESS_MESSAGES.BOOKING_REVERTED_TO_PENDING);
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error(`[SECURITY] Undo accept error: IP: ${clientIP}, Error: ${message}`);
    if (message === ERROR_MESSAGES.BOOKING_NOT_FOUND) {
      return errorResponse(message, 404);
    }
    const isRpcUnavailable =
      (message.includes('function') && message.includes('does not exist')) ||
      message.includes('Could not find the function');
    if (isRpcUnavailable) {
      return errorResponse(ERROR_MESSAGES.DATABASE_ERROR, 503);
    }
    // Any other failure (state machine, RPC result, window, etc.) is a conflict from user's perspective
    return errorResponse(message, 409);
  }
}
