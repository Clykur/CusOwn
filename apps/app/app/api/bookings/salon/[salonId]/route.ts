import { NextRequest } from 'next/server';
import { bookingService } from '@cusown/shared/server';
import { successResponse, errorResponse } from '@cusown/shared/server';
import { getClientIp, isValidUUID } from '@cusown/shared/server';
import { setNoCacheHeaders } from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';
import { getServerUser } from '@cusown/shared/server';
import { userService } from '@cusown/shared/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ salonId: string }> }
) {
  const clientIP = getClientIp(request);

  try {
    await bookingService.runLazyExpireIfNeeded();

    const { salonId } = await params;
    const { searchParams } = new URL(request.url);
    const fromDate = searchParams.get('fromDate') || undefined;
    const toDate = searchParams.get('toDate') || undefined;

    if (!salonId || !isValidUUID(salonId)) {
      console.warn(`[SECURITY] Invalid salon ID format from IP: ${clientIP}`);
      return errorResponse('Invalid salon ID', 400);
    }

    // Authorization: user must own the business or be admin
    const user = await getServerUser(request);
    if (user) {
      const userBusinesses = await userService.getUserBusinesses(user.id);
      const hasAccess = userBusinesses.some((b) => b.id === salonId);

      if (!hasAccess) {
        // Check if user is admin
        const profile = await userService.getUserProfile(user.id);
        const isAdmin = profile?.user_type === 'admin';

        if (!isAdmin) {
          console.warn(
            `[SECURITY] Unauthorized salon bookings access from IP: ${clientIP}, User: ${user.id.substring(0, 8)}..., Salon: ${salonId.substring(0, 8)}...`
          );
          return errorResponse('Access denied', 403);
        }
      }
    } else {
      console.warn(
        `[SECURITY] Unauthenticated salon bookings access from IP: ${clientIP}, Salon: ${salonId.substring(0, 8)}...`
      );
      return errorResponse('Authentication required', 401);
    }

    const bookings = await bookingService.getSalonBookings(salonId, fromDate, toDate);

    const response = successResponse(bookings);
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error(`[SECURITY] Salon bookings access error: IP: ${clientIP}, Error: ${message}`);
    return errorResponse(message, 500);
  }
}
