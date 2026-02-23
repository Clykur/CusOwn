/**
 * GET /book/complete — after login from public booking: read pending cookie, create booking, redirect to booking details.
 */

import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createHash } from 'crypto';
import { getServerUser } from '@/lib/supabase/server-auth';
import { ROUTES } from '@/lib/utils/navigation';
import { PENDING_BOOKING_COOKIE } from '@/config/constants';
import { verifyPendingBookingCookie } from '@/lib/auth/pending-booking-cookie';
import { bookingService } from '@/services/booking.service';
import { salonService } from '@/services/salon.service';
import { slotService } from '@/services/slot.service';
import { reminderService } from '@/services/reminder.service';
import { whatsappService } from '@/services/whatsapp.service';
import { auditService } from '@/services/audit.service';
import { emitBookingCreated } from '@/lib/events/booking-events';
import { metricsService } from '@/lib/monitoring/metrics';
import { logBookingLifecycle } from '@/lib/monitoring/lifecycle-structured-log';
import { getBookingStatusUrl } from '@/lib/utils/url';
import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { METRICS_BOOKING_CREATED } from '@/config/constants';

export const dynamic = 'force-dynamic';

function clearPendingCookie(res: NextResponse): void {
  res.cookies.set(PENDING_BOOKING_COOKIE, '', {
    path: '/',
    maxAge: 0,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });
}

export async function GET(request: NextRequest) {
  const user = await getServerUser(request);
  if (!user) {
    const loginUrl = ROUTES.AUTH_LOGIN('/book/complete') + '&role=customer';
    const res = NextResponse.redirect(new URL(loginUrl, request.url));
    clearPendingCookie(res);
    return res;
  }

  const cookieStore = await cookies();
  const cookieValue = cookieStore.get(PENDING_BOOKING_COOKIE)?.value;
  const payload = verifyPendingBookingCookie(cookieValue);

  if (!payload) {
    const res = NextResponse.redirect(new URL(ROUTES.CUSTOMER_DASHBOARD, request.url));
    clearPendingCookie(res);
    return res;
  }

  const idempotencyKey =
    'pending-' + createHash('sha256').update(JSON.stringify(payload)).digest('hex').slice(0, 64);

  try {
    await bookingService.runLazyExpireIfNeeded();
    const supabase = requireSupabaseAdmin();
    const params = await bookingService.prepareCreateBookingParams(
      {
        salon_id: payload.salon_id,
        slot_id: payload.slot_id,
        customer_name: payload.customer_name,
        customer_phone: payload.customer_phone,
      },
      user.id,
      undefined
    );

    const { data: idemResult, error: idemError } = await supabase.rpc(
      'create_booking_idempotent_reserve',
      {
        p_key: idempotencyKey,
        p_ttl_hours: 24,
        p_business_id: params.p_business_id,
        p_slot_id: params.p_slot_id,
        p_customer_name: params.p_customer_name,
        p_customer_phone: params.p_customer_phone,
        p_booking_id: params.p_booking_id,
        p_customer_user_id: params.p_customer_user_id,
        p_total_duration_minutes: params.p_total_duration_minutes,
        p_total_price_cents: params.p_total_price_cents,
        p_services_count: params.p_services_count,
        p_service_data: params.p_service_data,
      }
    );

    if (idemError) throw new Error(idemError.message);
    const row = Array.isArray(idemResult) ? idemResult[0] : idemResult;
    const status = row?.status as string | undefined;
    const createdBookingId = row?.booking_id as string | undefined;

    if (status === 'duplicate' && createdBookingId) {
      const res = NextResponse.redirect(
        new URL(getBookingStatusUrl(createdBookingId), request.url)
      );
      clearPendingCookie(res);
      return res;
    }
    if (status !== 'created' || !createdBookingId) {
      const res = NextResponse.redirect(new URL(ROUTES.CUSTOMER_DASHBOARD, request.url));
      clearPendingCookie(res);
      return res;
    }

    const booking = await bookingService.getBookingByUuidWithDetails(createdBookingId);
    if (!booking) {
      const res = NextResponse.redirect(new URL(ROUTES.CUSTOMER_DASHBOARD, request.url));
      clearPendingCookie(res);
      return res;
    }

    const salon = await salonService.getSalonById(payload.salon_id);
    const slot = await slotService.getSlotById(payload.slot_id);
    if (salon && slot) {
      const bookingWithDetails = { ...booking, salon, slot };
      await emitBookingCreated(bookingWithDetails);
      await reminderService.scheduleBookingReminders(booking.id);
      try {
        whatsappService.generateBookingRequestMessage(bookingWithDetails, salon, request);
      } catch {
        // non-fatal
      }
    }

    await metricsService.increment('bookings.created');
    await metricsService.increment(METRICS_BOOKING_CREATED);
    logBookingLifecycle({
      booking_id: booking.id,
      slot_id: booking.slot_id,
      action: 'booking_created',
      actor: user.id,
      source: 'api',
    });
    try {
      await auditService.createAuditLog(user.id, 'booking_created', 'booking', {
        entityId: booking.id,
        description: `Booking created for ${payload.customer_name} (post-login complete)`,
        request,
      });
    } catch {
      // non-fatal
    }

    const res = NextResponse.redirect(
      new URL(getBookingStatusUrl(booking.booking_id), request.url)
    );
    clearPendingCookie(res);
    return res;
  } catch {
    const res = NextResponse.redirect(new URL(ROUTES.CUSTOMER_DASHBOARD, request.url));
    clearPendingCookie(res);
    return res;
  }
}
