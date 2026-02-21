'use client';

/**
 * Applies global fetch patch to block Supabase refresh_token requests (runs on module load).
 * Renders nothing. Must be mounted early (e.g. root layout) so the patch is active before any Supabase client code.
 */
import '@/lib/init/supabase-refresh-block.client';

export function SupabaseRefreshBlock() {
  return null;
}
