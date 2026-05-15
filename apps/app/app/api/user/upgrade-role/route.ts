import { NextRequest } from "next/server";
import {
  requireAuth,
  validateCSRFToken,
  requireSupabaseAdmin,
  successResponse,
  errorResponse,
  userService,
  invalidateProfileCache,
  auditService,
} from "@cusown/shared/server";
import { type RoleName } from "@cusown/config";

const ROUTE = "POST /api/user/upgrade-role";

type UpgradableRole = Extract<RoleName, "owner" | "customer">;

const ALLOWED_ROLES: ReadonlySet<string> = new Set(["owner", "customer"]);

function isUpgradableRole(value: unknown): value is UpgradableRole {
  return typeof value === "string" && ALLOWED_ROLES.has(value);
}

/**
 * POST /api/user/upgrade-role
 * Adds owner/customer role for current user only (idempotent).
 */
export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuth(request, ROUTE);
    if (auth instanceof Response) return auth;

    const csrfValid = await validateCSRFToken(request);
    if (!csrfValid) {
      return errorResponse("Invalid CSRF token", 403);
    }

    const supabase = requireSupabaseAdmin();
    if (!supabase) {
      return errorResponse("Database not configured", 500);
    }

    const body = await request.json().catch(() => null);
    const requestedRole = body?.role;
    if (!isUpgradableRole(requestedRole)) {
      return errorResponse('Invalid role. Must be "customer" or "owner"', 400);
    }

    const profile = await userService.getUserProfile(auth.user.id);
    const currentRoles =
      profile?.user_type === "both"
        ? ["customer", "owner"]
        : profile?.user_type === "admin"
          ? ["admin"]
          : profile?.user_type
            ? [profile.user_type]
            : [];

    const newRoles = Array.from(new Set([...currentRoles, requestedRole]));
    await userService.setUserRoles(auth.user.id, newRoles);

    const updatedProfile = await userService.getUserProfile(auth.user.id);
    const nextUserType = updatedProfile?.user_type || "customer";

    invalidateProfileCache(auth.user.id);

    // Audit Log
    await auditService.createAuditLog(auth.user.id, "role_upgraded", "user", {
      entityId: auth.user.id,
      oldData: { roles: currentRoles },
      newData: { roles: newRoles, user_type: nextUserType },
      description: `User upgraded role to include ${requestedRole}`,
    });

    return successResponse({
      role: requestedRole,
      user_type: nextUserType,
      roles: newRoles,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to upgrade role";
    return errorResponse(message, 500);
  }
}
