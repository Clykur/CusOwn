import { NextRequest } from "next/server";
import { noShowService } from "@cusown/shared/server";
import { bookingService } from "@cusown/shared/server";
import { notificationService } from "@cusown/shared/server";
import { userService } from "@cusown/shared/server";
import { successResponse, errorResponse } from "@cusown/shared/server";
import { isValidUUID } from "@cusown/shared/server";
import { setNoCacheHeaders } from "@cusown/shared/server";
import { getAuthContext } from "@cusown/shared/server";
import { ERROR_MESSAGES } from "@cusown/config";
import { auditService } from "@cusown/shared/server";
import { isAdminProfile } from "@cusown/shared/server";
import { logAuthDeny } from "@cusown/shared/server";

const ROUTE = "POST /api/bookings/[id]/no-show";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await bookingService.runLazyExpireIfNeeded();

    const { id } = await params;
    if (!id || !isValidUUID(id)) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const ctx = await getAuthContext(request);
    if (!ctx) {
      logAuthDeny({ route: ROUTE, reason: "auth_missing", resource: id });
      return errorResponse("Authentication required", 401);
    }

    const booking = await bookingService.getBookingByUuidWithDetails(id);
    if (!booking) {
      return errorResponse(ERROR_MESSAGES.BOOKING_NOT_FOUND, 404);
    }

    const userBusinesses = await userService.getUserBusinesses(ctx.user.id);
    const ownsBusiness = userBusinesses.some(
      (b) => b.id === booking.business_id,
    );
    if (!ownsBusiness && !isAdminProfile(ctx.profile)) {
      logAuthDeny({
        user_id: ctx.user.id,
        route: ROUTE,
        reason: "auth_denied",
        role: (ctx.profile as { user_type?: string })?.user_type ?? "unknown",
        resource: id,
      });
      return errorResponse("Access denied", 403);
    }

    const updatedBooking = await noShowService.markNoShow({
      bookingId: id,
      markedBy: "owner",
    });

    // SECURITY: Log mutation for audit
    try {
      await auditService.createAuditLog(
        ctx.user.id,
        "booking_no_show",
        "booking",
        {
          entityId: id,
          description: "Booking marked as no-show by owner",
          request,
        },
      );
    } catch (auditError) {
      console.error("[SECURITY] Failed to create audit log:", auditError);
    }

    if (booking.salon) {
      const message = `We noticed you didn't show up for your appointment on ${booking.slot?.date} at ${booking.slot?.start_time}. Please contact us to reschedule.`;
      try {
        await notificationService.sendBookingNotification(
          id,
          "whatsapp",
          message,
          booking.customer_phone,
        );
      } catch {}
    }

    const response = successResponse(updatedBooking);
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 400);
  }
}
