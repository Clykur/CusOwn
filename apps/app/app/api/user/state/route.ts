/**
 * Server-only: return current user state (canAccessOwnerDashboard, etc.) for UI.
 * Uses getServerUser + getUserState; no client-side auth.
 */

import { NextRequest } from "next/server";
import {
  getServerUser,
  getUserState,
  errorResponse,
  successResponse,
} from "@cusown/shared/server";
import { ERROR_MESSAGES } from "@cusown/config";

export async function GET(request: NextRequest) {
  try {
    const user = await getServerUser(request);
    console.log("[API:user:state] getServerUser returned", { hasUser: !!user });

    if (!user) {
      console.log("[API:user:state] Unauthorized - no user");
      return errorResponse(ERROR_MESSAGES.UNAUTHORIZED, 401);
    }

    const state = await getUserState(user.id, { skipCache: true });
    console.log("[API:user:state] getUserState returned", {
      state: state?.state,
    });

    const response = successResponse(state);

    // Set the role cookie for client-side navigation (e.g. useLogoNavigation)
    if (state.userType) {
      response.cookies.set("cusown_user_role", state.userType, {
        path: "/",
        maxAge: 60 * 60 * 24 * 7, // 1 week
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
      });
    }

    return response;
  } catch (error) {
    console.error("[API:user:state] Error:", error);
    return errorResponse("Unknown error", 500);
  }
}
