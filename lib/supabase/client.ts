import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { publicEnv } from '@/config/env.public';

/**
 * Client-side Supabase client. Session is also available via /api/auth/session.
 * Refresh is throttled by global fetch patch (see layout.tsx script).
 *
 * Safe initialization: only creates client if both URL and anon key are configured.
 * Returns null if credentials are missing (e.g., in development without env vars).
 */

const supabaseUrl = publicEnv.supabase.url?.trim() || '';
const supabaseAnonKey = publicEnv.supabase.anonKey?.trim() || '';

let supabaseInstance: SupabaseClient | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseInstance = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name) {
          if (typeof document === 'undefined') return undefined;
          const cookies = document.cookie.split(';').map((c) => c.trim());
          const match = cookies.find((c) => c.startsWith(`${name}=`));
          return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined;
        },
        set(name, value, options) {
          if (typeof document === 'undefined') return;
          const opts = options ?? {};
          const parts = [`${name}=${encodeURIComponent(value)}`];
          parts.push(`Path=${opts.path ?? '/'}`);
          if (opts.maxAge != null) parts.push(`Max-Age=${opts.maxAge}`);
          if (opts.expires) parts.push(`Expires=${opts.expires.toUTCString()}`);
          if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
          if (opts.secure) parts.push('Secure');
          document.cookie = parts.join('; ');
        },
        remove(name, options) {
          if (typeof document === 'undefined') return;
          const opts = options ?? {};
          document.cookie = `${name}=; Path=${opts.path ?? '/'}; Max-Age=0`;
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: true,
        detectSessionInUrl: true,
        flowType: 'pkce',
      },
    });
  } catch (error) {
    console.error('[supabase-client] Failed to initialize Supabase client:', error);
    supabaseInstance = null;
  }
} else {
  const missing = [];
  if (!supabaseUrl) missing.push('NEXT_PUBLIC_SUPABASE_URL');
  if (!supabaseAnonKey) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  if (typeof window !== 'undefined') {
    console.warn(
      `[supabase-client] Missing or invalid Supabase configuration (${missing.join(', ')}). ` +
        'Ensure NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY are set in your environment.'
    );
  }
}

/**
 * Nullable Supabase client instance. May be null if credentials are not configured.
 * Always check before using: if (supabase) { await supabase.auth.getUser() }
 */
export const supabase = supabaseInstance;

/**
 * Get the Supabase client, throwing a helpful error if not configured.
 * Use this when Supabase is required for a feature.
 */
export function getSupabaseClient(): SupabaseClient {
  if (!supabaseInstance) {
    throw new Error(
      '[supabase-client] Supabase is not configured. ' +
        'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in your environment. ' +
        'In production, configure these in your deployment platform (Vercel, etc.).'
    );
  }
  return supabaseInstance;
}
