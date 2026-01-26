import { NextRequest } from 'next/server';
import { successResponse, errorResponse } from '@/lib/utils/response';
import { isValidUUID } from '@/lib/utils/security';
import { getServerUser } from '@/lib/supabase/server-auth';
import { bookingService } from '@/services/booking.service';
import { paymentService } from '@/services/payment.service';
import { enhancedRateLimit } from '@/lib/security/rate-limit-enhanced';
import { checkNonce, storeNonce } from '@/lib/security/nonce-store';

const paymentRateLimit = enhancedRateLimit({
  maxRequests: 10,
  windowMs: 3600000,
  perUser: true,
  perIP: true,
  keyPrefix: 'payment',
});

export async function POST(request: NextRequest) {
  const clientIP = request.ip || request.headers.get('x-forwarded-for') || 'unknown';

  try {
    const rateLimitResponse = await paymentRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const user = await getServerUser(request);
    if (!user) {
      return errorResponse('Authentication required', 401);
    }

    const idempotencyKey = request.headers.get('x-idempotency-key');
    if (!idempotencyKey || !isValidUUID(idempotencyKey)) {
      return errorResponse('Invalid idempotency key', 400);
    }

    const existingPayment = await paymentService.getPaymentByIdempotencyKey(idempotencyKey);
    if (existingPayment) {
      return successResponse({ payment: existingPayment });
    }

    const requestId = request.headers.get('x-request-id');
    if (requestId) {
      if (!isValidUUID(requestId)) {
        return errorResponse('Invalid request ID', 400);
      }

      const nonceExists = await checkNonce(requestId);
      if (nonceExists) {
        return errorResponse('Duplicate request', 409);
      }

      await storeNonce(requestId, user.id, clientIP);
    }

    const body = await request.json();
    const { filterFields } = await import('@/lib/security/input-filter');
    const allowedFields = ['booking_id', 'payment_type', 'provider'] as const;
    const filteredBody = filterFields(body, allowedFields);

    if (!isValidUUID(filteredBody.booking_id)) {
      return errorResponse('Invalid booking ID', 400);
    }

    if (!['razorpay', 'stripe', 'cash'].includes(filteredBody.provider)) {
      return errorResponse('Invalid payment provider', 400);
    }

    const paymentType = filteredBody.payment_type || 'full';
    if (!['full', 'deposit', 'cash'].includes(paymentType)) {
      return errorResponse('Invalid payment type', 400);
    }

    const booking = await bookingService.getBookingByUuidWithDetails(filteredBody.booking_id);
    if (!booking) {
      return errorResponse('Booking not found', 404);
    }

    if (user.id !== booking.customer_user_id) {
      return errorResponse('Access denied', 403);
    }

    if (booking.status !== 'pending') {
      return errorResponse('Booking cannot be paid', 409);
    }

    const existingPaymentForBooking = await paymentService.getPaymentByBooking(booking.id);
    if (existingPaymentForBooking?.status === 'completed') {
      return errorResponse('Payment already completed', 409);
    }

    const totalPriceCents = booking.total_price_cents || 0;
    const calculatedAmount = paymentService.calculatePaymentAmount(totalPriceCents, paymentType);

    if (filteredBody.provider === 'cash') {
      const payment = await paymentService.createPayment(
        booking.id,
        'cash',
        calculatedAmount,
        idempotencyKey,
        paymentType
      );

      await paymentService.updatePaymentStatus(payment.id, 'completed');
      await bookingService.confirmBooking(booking.id, 'system');

      return successResponse({ payment, payment_intent: null });
    }

    const payment = await paymentService.createPayment(
      booking.id,
      filteredBody.provider,
      calculatedAmount,
      idempotencyKey,
      paymentType
    );

    await paymentService.updatePaymentStatus(payment.id, 'processing', payment.id);

    const paymentIntent = {
      payment_id: payment.id,
      provider: filteredBody.provider,
    };

    return successResponse({ payment, payment_intent: paymentIntent });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Payment creation failed';
    return errorResponse(message, 500);
  }
}
