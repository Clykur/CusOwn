import { NextRequest } from 'next/server';
import { 
  bookingService,
  successResponse,
  errorResponse,
  requireCustomer,
  setCacheHeaders
} from '@cusown/shared/server';
import { ERROR_MESSAGES } from '@cusown/config';

const ROUTE = 'GET /api/customer/bookings';

/**
 * GET /api/customer/bookings
 * Get all bookings for the authenticated customer.
 * Requires customer, both, or admin role (shared guard only).
 */
export async function GET(request: NextRequest) {
  try {
    // Parallel: run lazy expire and auth check simultaneously
    const [, auth] = await Promise.all([
      bookingService.runLazyExpireIfNeeded(),
      requireCustomer(request, ROUTE),
    ]);

    if (auth instanceof Response) return auth;

    const bookings = await bookingService.getCustomerBookings(auth.user.id);
    const response = successResponse(bookings);
    setCacheHeaders(response, 30, 60);
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}
