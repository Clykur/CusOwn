import { NextRequest } from "next/server";
import { successResponse, errorResponse } from "@cusown/shared/server";
import { getServerUser } from "@cusown/shared/server";
import { paymentService } from "@cusown/shared/server";
import { bookingService } from "@cusown/shared/server";
import { enhancedRateLimit } from "@cusown/shared/server";

const statusRateLimit = enhancedRateLimit({
  maxRequests: 30,
  windowMs: 60000,
  perIP: true,
  keyPrefix: "payment_status",
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ paymentId: string }> },
) {
  try {
    const rateLimitResponse = await statusRateLimit(request);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const user = await getServerUser(request);
    if (!user) {
      return errorResponse("Authentication required", 401);
    }

    const { paymentId } = await params;
    if (!paymentId) {
      return errorResponse("Payment ID required", 400);
    }

    const payment = await paymentService.getPaymentByPaymentId(paymentId);
    if (!payment) {
      return errorResponse("Payment not found", 404);
    }

    const booking = await bookingService.getBookingByUuidWithDetails(
      payment.booking_id,
    );
    if (!booking) {
      return errorResponse("Booking not found", 404);
    }

    if (booking.customer_user_id && booking.customer_user_id !== user.id) {
      const { userService } = await import("@cusown/shared/server");
      const userProfile = await userService.getUserProfile(user.id);

      const isAdmin = userProfile?.user_type === "admin";
      const isOwner =
        userProfile?.user_type === "owner" || userProfile?.user_type === "both";

      if (!isAdmin && !isOwner) {
        return errorResponse("Unauthorized", 403);
      }
    }

    return successResponse({
      payment_id: payment.payment_id,
      status: payment.status,
      amount_cents: payment.amount_cents,
      currency: payment.currency,
      expires_at: payment.expires_at,
      transaction_id: payment.transaction_id,
      verified_at: payment.verified_at,
      upi_app_used: payment.upi_app_used,
      attempt_count: payment.attempt_count,
      booking_id: booking.id,
      booking_status: booking.status,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to get payment status";
    console.error("[PAYMENT_STATUS] Error:", error);
    return errorResponse(message, 500);
  }
}
