import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { env } from "@cusown/config";

/**
 * Server-side Supabase admin client
 * Only creates client if credentials are available
 */
let supabaseAdminInstance: SupabaseClient | null = null;

const createSupabaseAdmin = (): SupabaseClient | null => {
  // Check environment variables directly to ensure they're loaded
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.supabase.url?.trim();
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    env.supabase.serviceRoleKey?.trim();

  if (!url || !serviceRoleKey || url === "" || serviceRoleKey === "") {
    const isServer =
      typeof (globalThis as Record<string, unknown>).window === "undefined";
    if (process.env.NODE_ENV === "development" && isServer) {
      console.warn(
        `[SUPABASE] ⚠️  Credentials missing. URL: ${url ? "set" : "MISSING"}, Key: ${serviceRoleKey ? "set" : "MISSING"}`,
      );
    }
    return null;
  }

  if (url.includes("placeholder.supabase.co")) {
    console.warn("[SUPABASE] ⚠️  Using placeholder URL. API calls will fail.");
  }

  try {
    console.log(`[SUPABASE] Initializing admin client with URL: ${url}`);
    return createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch (error) {
    if (process.env.NODE_ENV === "development") {
      console.error("[SUPABASE] Failed to create admin client:", error);
    }
    return null;
  }
};

// Initialize immediately but safely
try {
  supabaseAdminInstance = createSupabaseAdmin();
} catch (error) {
  // If initialization fails, set to null
  supabaseAdminInstance = null;
  if (process.env.NODE_ENV === "development") {
    console.error("Supabase admin client initialization failed:", error);
  }
}

/**
 * Helper to ensure Supabase is configured
 * Throws a clear error if not configured
 */
export const requireSupabaseAdmin = (): SupabaseClient => {
  if (!supabaseAdminInstance) {
    supabaseAdminInstance = createSupabaseAdmin();
  }

  if (!supabaseAdminInstance) {
    console.error(
      "[SUPABASE] ERROR: supabaseAdminInstance is null. Check credentials and initialization.",
    );
    throw new Error(
      "Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file.",
    );
  }
  return supabaseAdminInstance;
};

// requireSupabaseAdmin should be used instead of direct export to ensure client is initialized properly in Next.js environment.
