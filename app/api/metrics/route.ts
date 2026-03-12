import { NextRequest } from 'next/server';
import { safeMetrics } from '@/lib/monitoring/safe-metrics';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { getServerUser } from '@/lib/supabase/server-auth';
import { isAdmin } from '@/lib/supabase/auth';
import {
  METRICS_BOOKING_CREATED,
  METRICS_BOOKING_CONFIRMED,
  METRICS_BOOKING_REJECTED,
  METRICS_BOOKING_CANCELLED_USER,
  METRICS_BOOKING_CANCELLED_SYSTEM,
  METRICS_EXPIRED_BY_CRON,
  METRICS_EXPIRED_BY_LAZY_HEAL,
  METRICS_PAYMENT_CREATED,
  METRICS_PAYMENT_SUCCEEDED,
  METRICS_PAYMENT_FAILED,
} from '@/config/constants';

/** Phase 4: Dashboard API — booking funnel, expiry rate, payment success rate. */
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

    const [
      bookingCreated,
      bookingConfirmed,
      bookingRejected,
      bookingCancelledUser,
      bookingCancelledSystem,
      expiredByCron,
      expiredByLazyHeal,
      paymentCreated,
      paymentSucceeded,
      paymentFailed,
    ] = await Promise.all([
      safeMetrics.getCount(METRICS_BOOKING_CREATED),
      safeMetrics.getCount(METRICS_BOOKING_CONFIRMED),
      safeMetrics.getCount(METRICS_BOOKING_REJECTED),
      safeMetrics.getCount(METRICS_BOOKING_CANCELLED_USER),
      safeMetrics.getCount(METRICS_BOOKING_CANCELLED_SYSTEM),
      safeMetrics.getCount(METRICS_EXPIRED_BY_CRON),
      safeMetrics.getCount(METRICS_EXPIRED_BY_LAZY_HEAL),
      safeMetrics.getCount(METRICS_PAYMENT_CREATED),
      safeMetrics.getCount(METRICS_PAYMENT_SUCCEEDED),
      safeMetrics.getCount(METRICS_PAYMENT_FAILED),
    ]);

    const totalExpired = expiredByCron + expiredByLazyHeal;
    const expiryRate = bookingCreated > 0 ? totalExpired / bookingCreated : 0;
    const paymentTotal = paymentCreated > 0 ? paymentCreated : 1;
    const paymentSuccessRate = paymentSucceeded / paymentTotal;
    const paymentFailureRate = paymentFailed / paymentTotal;

    const slotFetchTimings = await safeMetrics.getTimings('slots.fetch');
    const avgSlotFetchTime =
      slotFetchTimings.length > 0
        ? slotFetchTimings.reduce((a, b) => a + b, 0) / slotFetchTimings.length
        : 0;

    return successResponse({
      funnel: {
        booking_created: bookingCreated,
        booking_confirmed: bookingConfirmed,
        booking_rejected: bookingRejected,
        booking_cancelled_user: bookingCancelledUser,
        booking_cancelled_system: bookingCancelledSystem,
      },
      expiry: {
        expired_by_cron: expiredByCron,
        expired_by_lazy_heal: expiredByLazyHeal,
        total_expired: totalExpired,
        expiry_rate: Math.round(expiryRate * 10000) / 100,
      },
      payment: {
        payment_created: paymentCreated,
        payment_succeeded: paymentSucceeded,
        payment_failed: paymentFailed,
        payment_success_rate: Math.round(paymentSuccessRate * 10000) / 100,
        payment_failure_rate: Math.round(paymentFailureRate * 10000) / 100,
      },
      bookings: {
        created: bookingCreated,
        confirmed: bookingConfirmed,
        cancelled: bookingCancelledUser + bookingCancelledSystem,
        rejected: bookingRejected,
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
