"use client";

/**
 * Applies global fetch patch to block Supabase refresh_token requests (runs on module load).
 * Renders nothing. Must be mounted early (e.g. root layout) so the patch is active before any Supabase client code.
 */
import "@cusown/shared";

export function SupabaseRefreshBlock() {
  return null;
}
