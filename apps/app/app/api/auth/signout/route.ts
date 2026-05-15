/**
 * Server-only auth: sign out. Clears session server-side and redirects to login (or redirect_to if provided).
 * Frontend links or navigates here; no client-side Supabase auth.
 */

import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@cusown/shared/server";
import { ROUTES } from "@cusown/shared/server";
import { env } from "@cusown/config";

/** Allow only relative paths (no protocol, no //). */
function isSafeRedirect(path: string | null): path is string {
  if (!path || typeof path !== "string") return false;
  const trimmed = path.trim();
  return (
    trimmed.startsWith("/") &&
    !trimmed.startsWith("//") &&
    !/^https?:\/\//i.test(trimmed)
  );
}

export async function GET(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  const email = session?.session?.user?.email ?? undefined;
  const { error } = await supabase.auth.signOut();
  if (!error && userId) {
    try {
      const { authEventsService } = await import("@cusown/shared/server");
      const { getClientIp } = await import("@cusown/shared/server");
      authEventsService.insert("logout", {
        userId,
        email,
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent") ?? undefined,
      });
    } catch {
      // optional logging
    }
  }
  if (error) {
    console.log("[AUTH] signout GET: negative", { error: error.message });
  } else {
    console.log(
      "[AUTH] signout GET: positive — session cleared, redirect to login",
    );
  }
  const redirectTo = request.nextUrl.searchParams.get("redirect_to");
  const targetPath = isSafeRedirect(redirectTo)
    ? redirectTo
    : typeof ROUTES.AUTH_LOGIN === "function"
      ? ROUTES.AUTH_LOGIN()
      : "/auth/login";
  return NextResponse.redirect(new URL(targetPath, env.app.baseUrl));
}

export async function POST(request: NextRequest) {
  const supabase = await createServerClient();
  const { data: session } = await supabase.auth.getSession();
  const userId = session?.session?.user?.id;
  const email = session?.session?.user?.email ?? undefined;
  const { error } = await supabase.auth.signOut();
  if (!error && userId) {
    try {
      const { authEventsService } = await import("@cusown/shared/server");
      const { getClientIp } = await import("@cusown/shared/server");
      authEventsService.insert("logout", {
        userId,
        email,
        ip: getClientIp(request),
        userAgent: request.headers.get("user-agent") ?? undefined,
      });
    } catch {
      // optional logging
    }
  }
  if (error) {
    console.log("[AUTH] signout POST: negative", { error: error.message });
  } else {
    console.log("[AUTH] signout POST: positive — session cleared");
  }
  return NextResponse.json({ success: true });
}
