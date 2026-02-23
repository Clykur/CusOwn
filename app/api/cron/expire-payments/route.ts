import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { validateCronSecret } from '@/lib/security/cron-auth';
import { paymentService } from '@/services/payment.service';
import { bookingService } from '@/services/booking.service';
import { slotService } from '@/services/slot.service';
import { BOOKING_STATUS, SLOT_STATUS } from '@/config/constants';
import { withCronRunLog } from '@/services/cron-run.service';

export async function POST(request: NextRequest) {
  try {
    const authError = validateCronSecret(request);
    if (authError) return authError;

    return await withCronRunLog('expire-payments', async () => {
      const expiredCount = await paymentService.expirePayments();
      const supabaseAdmin = await import('@/lib/supabase/server').then((m) =>
        m.requireSupabaseAdmin()
      );
      const { data: expiredPayments } = await supabaseAdmin
        .from('payments')
        .select('booking_id, id')
        .eq('status', 'expired')
        .is('verified_at', null);

      if (expiredPayments && expiredPayments.length > 0) {
        for (const payment of expiredPayments) {
          try {
            const booking = await bookingService.getBookingByUuidWithDetails(payment.booking_id);
            if (booking && booking.status === BOOKING_STATUS.PENDING) {
              const slot = await slotService.getSlotById(booking.slot_id);
              if (slot && slot.status === SLOT_STATUS.RESERVED) {
                await slotService.releaseSlot(booking.slot_id);
              }
            }
          } catch (error) {
            console.error(
              `[CRON] Failed to release slot for expired payment ${payment.id}:`,
              error
            );
          }
        }
      }

      return successResponse({
        expired_payments: expiredCount,
        message: `Expired ${expiredCount} payment(s)`,
      });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment expiration failed';
    console.error('[CRON] Error expiring payments:', error);
    return errorResponse(message, 500);
  }
}
