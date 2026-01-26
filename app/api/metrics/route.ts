import { NextRequest } from 'next/server';
import { metricsService } from '@/lib/monitoring/metrics';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getServerUser } from '@/lib/supabase/server-auth';
import { isAdmin } from '@/lib/supabase/auth';

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Unauthorized', 401);
    }

    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      return errorResponse('Forbidden', 403);
    }

    const bookingsCreated = await metricsService.getCount('bookings.created');
    const bookingsConfirmed = await metricsService.getCount('bookings.confirmed');
    const bookingsCancelled = await metricsService.getCount('bookings.cancelled');
    const bookingsRejected = await metricsService.getCount('bookings.rejected');

    const slotFetchTimings = await metricsService.getTimings('slots.fetch');
    const avgSlotFetchTime = slotFetchTimings.length > 0
      ? slotFetchTimings.reduce((a, b) => a + b, 0) / slotFetchTimings.length
      : 0;

    return successResponse({
      bookings: {
        created: bookingsCreated,
        confirmed: bookingsConfirmed,
        cancelled: bookingsCancelled,
        rejected: bookingsRejected,
      },
      performance: {
        avgSlotFetchTime: Math.round(avgSlotFetchTime),
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch metrics';
    return errorResponse(message, 500);
  }
}
