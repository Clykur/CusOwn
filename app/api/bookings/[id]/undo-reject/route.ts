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
import { hasPermission, PERMISSIONS } from '@/services/permission.service';
import { logAuthDeny } from '@/lib/monitoring/auth-audit';

const undoRejectRateLimit = enhancedRateLimit({
  maxRequests: 10,
  windowMs: 60000,
  perIP: true,
  keyPrefix: 'booking_undo_reject',
});
const ROUTE = 'POST /api/bookings/[id]/undo-reject';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const clientIP = getClientIp(request);

  try {
    await bookingService.runLazyExpireIfNeeded();

    const rateLimitResponse = await undoRejectRateLimit(request);
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

    const booking = await bookingService.getBookingByUuidWithDetails(id);
    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
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

    const updated = await bookingService.revertRejectToPending(id, ctx.user.id);
    try {
      await auditService.createAuditLog(ctx.user.id, 'booking_undo_reject', 'booking', {
        entityId: id,
        description: 'Booking reverted to pending (undo reject)',
        oldData: { status: 'rejected' },
        newData: { status: 'pending' },
        request,
      });
    } catch (auditError) {
      console.error('[SECURITY] Failed to create audit log:', auditError);
    }

    console.log(
      `[SECURITY] Booking undo reject: IP: ${clientIP}, Booking: ${id.substring(0, 8)}..., User: ${ctx.user.id.substring(0, 8)}...`
    );

    const response = successResponse(updated, SUCCESS_MESSAGES.BOOKING_REVERTED_TO_PENDING);
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error(`[SECURITY] Undo reject error: IP: ${clientIP}, Error: ${message}`);
    if (message === ERROR_MESSAGES.BOOKING_NOT_FOUND) {
      return errorResponse(message, 404);
    }
    const isRpcUnavailable =
      (message.includes('function') && message.includes('does not exist')) ||
      message.includes('Could not find the function');
    if (isRpcUnavailable) {
      return errorResponse(ERROR_MESSAGES.DATABASE_ERROR, 503);
    }
    // Any other failure is a conflict from user's perspective
    return errorResponse(message, 409);
  }
}
