import { NextRequest } from 'next/server';
import { bookingService } from '@/services/booking.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID, validateResourceToken } from '@/lib/utils/security';
import { ERROR_MESSAGES } from '@/config/constants';
import { getAuthContext, denyInvalidToken } from '@/lib/utils/api-auth-pipeline';
import { userService } from '@/services/user.service';
import { isAdminProfile } from '@/lib/utils/role-verification';
import { logAuthDeny } from '@/lib/monitoring/auth-audit';

const ROUTE = 'GET /api/bookings/[id]';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await bookingService.runLazyExpireIfNeeded();

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
      if (!validateResourceToken('booking-status', id, decodedToken)) {
        return denyInvalidToken(request, ROUTE, id);
      }
    }

    const booking = await bookingService.getBookingByUuidWithDetails(id);
    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const ctx = await getAuthContext(request);
    if (ctx) {
      const isCustomer = booking.customer_user_id === ctx.user.id;
      let isOwner = false;
      if (booking.business_id) {
        const userBusinesses = await userService.getUserBusinesses(ctx.user.id);
        isOwner = userBusinesses.some((b) => b.id === booking.business_id);
      }
      const isAdmin = isAdminProfile(ctx.profile);
      if (!isCustomer && !isOwner && !isAdmin && !token) {
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

    return successResponse(booking);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
