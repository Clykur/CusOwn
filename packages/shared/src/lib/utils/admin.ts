import { NextRequest } from "next/server";
import { isAdminProfile, type ProfileLike } from "./role-verification";
import { errorResponse } from "./api-auth-pipeline";

/**
 * Get user profile - works in both client and server contexts
 */
async function getUserProfileSafe(userId: string): Promise<any> {
  if (typeof window === "undefined") {
    const { getServerUserProfile } = await import("../supabase/server-auth");
    return getServerUserProfile(userId);
  } else {
    const { getUserProfile } = await import("../supabase/auth");
    return getUserProfile(userId);
  }
}

/**
 * Check if current user is admin.
 * Pass profile when already fetched (O(1)); otherwise fetches once.
 */
export const checkIsAdmin = async (
  userId: string,
  profile?: ProfileLike | null,
): Promise<boolean> => {
  if (profile !== undefined) return isAdminProfile(profile ?? null);
  try {
    const p = await getUserProfileSafe(userId);
    return isAdminProfile(p ?? null);
  } catch {
    return false;
  }
};

/**
 * Check if current user is admin (server-side)
 * @deprecated Use checkIsAdmin instead - it works in both contexts
 */
export const checkIsAdminServer = async (userId: string): Promise<boolean> => {
  return checkIsAdmin(userId);
};

/**
 * Admin-only helper - can be used as a guard in routes or as a direct check
 */
export const requireAdmin = async (
  requestOrUserId: NextRequest | string,
  routeName?: string,
) => {
  if (typeof requestOrUserId === "string") {
    const isAdmin = await checkIsAdmin(requestOrUserId);
    if (!isAdmin) throw new Error("Admin access required");
    return;
  }

  const { requireAuth } = await import("./api-auth-pipeline");
  const auth = await requireAuth(requestOrUserId, routeName || "unknown");
  if (auth instanceof Response) return auth;

  const isAdmin = await checkIsAdmin(auth.user.id);
  if (!isAdmin) {
    return errorResponse("Admin access required", 403);
  }

  return auth;
};
