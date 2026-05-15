import { NextRequest } from "next/server";
import {
  requireAuth,
  userService,
  successResponse,
  errorResponse,
  setNoCacheHeaders,
  dedupe,
  validateCSRFToken,
  getClientIp,
  auditService,
} from "@cusown/shared/server";

const ROUTE_GET = "GET /api/user/profile";
const ROUTE_PATCH = "PATCH /api/user/profile";
const ROUTE_DELETE = "DELETE /api/user/profile";

/**
 * GET /api/user/profile
 * Get current user's profile with additional account information
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ROUTE_GET);
    if (auth instanceof Response) return auth;

    // Get user profile (dedupe concurrent identical requests)
    const profile = await dedupe(`user:profile:${auth.user.id}`, () =>
      userService.getUserProfile(auth.user.id),
    );

    // Get additional account data
    let businessCount = 0;
    let bookingCount = 0;
    let businesses: any[] = [];
    let recentBookings: any[] = [];

    if (profile) {
      // Get business count if owner
      if (
        profile.user_type === "owner" ||
        profile.user_type === "both" ||
        profile.user_type === "admin"
      ) {
        try {
          businesses = await userService.getUserBusinesses(auth.user.id);
          businessCount = businesses.length;
        } catch (err) {
          console.error("[PROFILE_API] Error fetching businesses:", err);
          // Continue without businesses
        }
      }

      // Get booking count if customer
      if (
        profile.user_type === "customer" ||
        profile.user_type === "both" ||
        profile.user_type === "admin"
      ) {
        try {
          const bookings = await userService.getUserBookings(auth.user.id);
          bookingCount = bookings.length;
          recentBookings = bookings.slice(0, 5); // Get 5 most recent
        } catch (err) {
          console.error("[PROFILE_API] Error fetching bookings:", err);
          // Continue without bookings
        }
      }
    }

    const accountData = {
      id: auth.user.id,
      email: auth.user.email || null,
      email_confirmed:
        auth.user.email_confirmed_at !== null &&
        auth.user.email_confirmed_at !== undefined,
      created_at: auth.user.created_at || null,
      last_sign_in: auth.user.last_sign_in_at || null,
      profile: profile || null,
      statistics: {
        businessCount,
        bookingCount,
      },
      businesses: businesses.map((b) => ({
        id: b.id,
        salon_name: b.salon_name,
        booking_link: b.booking_link,
        location: b.location || null,
        created_at: b.created_at,
      })),
      recentBookings: recentBookings.map((b) => ({
        id: b.id,
        booking_id: b.booking_id,
        status: b.status,
        business_name: b.business?.salon_name || b.salon?.salon_name || "N/A",
        slot_date: b.slot?.date || null,
        slot_time: b.slot ? `${b.slot.start_time} - ${b.slot.end_time}` : null,
        created_at: b.created_at,
      })),
    };

    const response = successResponse(accountData);
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    console.error("[PROFILE_API] Error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to fetch profile";
    return errorResponse(message, 500);
  }
}

/**
 * PATCH /api/user/profile
 * Update user profile information
 */
export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ROUTE_PATCH);
    if (auth instanceof Response) return auth;

    const body = await request.json();
    const { full_name, phone_number } = body;

    // Validate input
    if (
      full_name !== undefined &&
      (typeof full_name !== "string" || full_name.trim().length < 2)
    ) {
      return errorResponse("Full name must be at least 2 characters", 400);
    }

    if (phone_number !== undefined && phone_number !== null) {
      if (
        typeof phone_number !== "string" ||
        !/^\+?[1-9]\d{1,14}$/.test(phone_number)
      ) {
        return errorResponse("Invalid phone number format", 400);
      }
    }

    // Get old profile for audit log
    const oldProfile = (await userService.getUserProfile(
      auth.user.id,
    )) as unknown as Record<string, unknown> | undefined;

    // Update profile
    const updatedProfile = (await userService.upsertUserProfile(auth.user.id, {
      full_name: full_name?.trim() || undefined,
      phone_number: phone_number?.trim() || undefined,
    })) as unknown as Record<string, unknown>;

    // Audit Log
    await auditService.createAuditLog(auth.user.id, "user_updated", "user", {
      entityId: auth.user.id,
      oldData: oldProfile ?? undefined,
      newData: updatedProfile ?? undefined,

      description: "User updated their profile information",
    });

    const response = successResponse(updatedProfile);
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to update profile";
    return errorResponse(message, 500);
  }
}

/**
 * DELETE /api/user/profile
 * Soft delete user account and all associated businesses.
 * Data is retained for 30 days for admin/recovery purposes.
 */
export async function DELETE(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ROUTE_DELETE);
    if (auth instanceof Response) return auth;

    // Verify CSRF token for state-changing operation
    const csrfValid = await validateCSRFToken(request);
    if (!csrfValid) {
      return errorResponse("Invalid CSRF token", 403);
    }

    // Get optional reason from request body
    let reason = "User requested account deletion";
    try {
      const body = await request.json();
      if (body.reason && typeof body.reason === "string") {
        reason = body.reason.substring(0, 500); // Limit reason length
      }
    } catch {
      // Body is optional
    }

    const clientIp = getClientIp(request);
    const result = await userService.softDeleteAccount(auth.user.id, reason, {
      actorId: auth.user.id,
      ip: clientIp ?? null,
    });

    // Audit Log
    await auditService.createAuditLog(auth.user.id, "user_deleted", "user", {
      entityId: auth.user.id,
      oldData: undefined,
      newData: undefined,
      description: `Account soft-deleted with reason: ${reason}`,

      metadata: { ip: clientIp },
    });

    const response = successResponse({
      ...result,
      message:
        "Your account and associated business data have been removed from the platform. For administrative and recovery purposes, your data will be securely stored for up to 30 days before being permanently deleted.",
    });
    setNoCacheHeaders(response);
    return response;
  } catch (error) {
    console.error("[PROFILE_API] Delete error:", error);
    const message =
      error instanceof Error ? error.message : "Failed to delete account";
    return errorResponse(message, 500);
  }
}
