import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { paymentService } from '@/services/payment.service';
import { bookingService } from '@/services/booking.service';
import { slotService } from '@/services/slot.service';
import { verifyRazorpayWebhook, getWebhookSecret } from '@/lib/security/webhook-verification';
import { createHash } from 'crypto';

export async function POST(request: NextRequest) {
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

  try {
    const signature = request.headers.get('x-razorpay-signature');
    if (!signature) {
      return errorResponse('Missing signature', 401);
    }

    const body = await request.text();
    const secret = getWebhookSecret('razorpay');

    if (!secret) {
      console.error('[WEBHOOK] Razorpay webhook secret not configured');
      return errorResponse('Webhook not configured', 500);
    }

    if (!verifyRazorpayWebhook(body, signature, secret)) {
      console.warn(`[SECURITY] Invalid Razorpay webhook signature from IP: ${clientIP}`);
      return errorResponse('Invalid signature', 401);
    }

    const payload = JSON.parse(body);
    const providerPaymentId = payload.payload?.payment?.entity?.id || payload.id;

    if (!providerPaymentId) {
      return errorResponse('Invalid webhook payload', 400);
    }

    const payloadHash = createHash('sha256').update(body).digest('hex');

    const { requireSupabaseAdmin } = await import('@/lib/supabase/server');
    const supabaseAdmin = requireSupabaseAdmin();

    const { data: existingPayment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('webhook_payload_hash', payloadHash)
      .single();

    if (existingPayment) {
      return successResponse({ success: true, message: 'Already processed' });
    }

    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('*')
      .eq('provider', 'razorpay')
      .eq('provider_payment_id', providerPaymentId)
      .single();

    if (!payment) {
      console.warn(`[WEBHOOK] Payment not found: ${providerPaymentId}`);
      return errorResponse('Payment not found', 404);
    }

    const razorpayPayment = payload.payload?.payment?.entity || payload;
    const paymentStatus = razorpayPayment.status === 'captured' ? 'completed' : 
                         razorpayPayment.status === 'failed' ? 'failed' : 'processing';

    if (razorpayPayment.amount !== payment.amount_cents) {
      console.error(`[SECURITY] Amount mismatch for payment ${payment.id}`);
      return errorResponse('Amount verification failed', 400);
    }

    await paymentService.updatePaymentStatus(
      payment.id,
      paymentStatus,
      providerPaymentId,
      { signature, payloadHash }
    );

    if (paymentStatus === 'completed' && payment.status !== 'completed') {
      const booking = await bookingService.getBookingByUuidWithDetails(payment.booking_id);
      if (booking && booking.status === 'pending') {
        await bookingService.confirmBooking(booking.id, 'system');
      }
    } else if (paymentStatus === 'failed' && payment.status !== 'failed') {
      const booking = await bookingService.getBookingByUuidWithDetails(payment.booking_id);
      if (booking && booking.status === 'pending') {
        await slotService.releaseSlot(booking.slot_id);
      }
    }

    return successResponse({ success: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Webhook processing failed';
    console.error('[WEBHOOK] Error:', error);
    return errorResponse(message, 500);
  }
}
