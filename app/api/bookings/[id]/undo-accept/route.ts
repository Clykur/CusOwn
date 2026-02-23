import { NextRequest } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getClientIp, isValidUUID } from '@/lib/utils/security';
import { setNoCacheHeaders } from '@/lib/cache/next-cache';
import { SUCCESS_MESSAGES, ERROR_MESSAGES } from '@/config/constants';
import { getAuthContext } from '@/lib/utils/api-auth-pipeline';
import { userService } from '@/services/user.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-api.security';
import { auditService } from '@/services/audit.service';
import { isAdminProfile } from '@/lib/utils/role-verification';
import { logAuthDeny } from '@/lib/monitoring/auth-audit';

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
      return errorResponse('Authentication required', 401);
    }

    const booking = await bookingService.getBookingByUuidWithDetails(id);
    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const userBusinesses = await userService.getUserBusinesses(ctx.user.id);
    const ownsBusiness = userBusinesses.some((b) => b.id === booking.business_id);
    if (!ownsBusiness && !isAdminProfile(ctx.profile)) {
      logAuthDeny({
        user_id: ctx.user.id,
        route: ROUTE,
        reason: 'auth_denied',
        role: (ctx.profile as { user_type?: string })?.user_type ?? 'unknown',
        resource: id,
      });
      return errorResponse('Access denied', 403);
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

    console.log(
      `[SECURITY] Booking undo accept: IP: ${clientIP}, Booking: ${id.substring(0, 8)}..., User: ${ctx.user.id.substring(0, 8)}...`
    );

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
