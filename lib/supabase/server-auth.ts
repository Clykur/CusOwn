import { env } from '@/config/env';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';
import { createSecureSetAll } from '@/lib/auth/cookie-adapter.server';
import {
  getCachedProfile,
  setCachedProfile,
  getCachedAuthUser,
  setCachedAuthUser,
} from '@/lib/cache/auth-cache';

// Lazy import cookies to avoid bundling in client
let cookiesModule: typeof import('next/headers') | null = null;
const getCookies = async () => {
  if (typeof window !== 'undefined') {
    throw new Error('createServerClient can only be used server-side');
  }
  if (!cookiesModule) {
    cookiesModule = await import('next/headers');
  }
  return cookiesModule.cookies();
};

// Lazy import supabaseAdmin to avoid bundling in client
let supabaseAdminInstance: any = null;
const getSupabaseAdmin = async () => {
  if (typeof window !== 'undefined') {
    throw new Error('Supabase admin can only be used server-side');
  }
  if (!supabaseAdminInstance) {
    const serverModule = await import('./server');
    supabaseAdminInstance = serverModule.supabaseAdmin;
  }
  return supabaseAdminInstance;
};

/**
 * Server-side Supabase client with user session
 * Use this in server components and API routes
 *
 * Note: For Next.js 14, we read the session from cookies
 * that are set by the client-side auth flow.
 */
export const createServerClient = async () => {
  const cookieStore = await getCookies();

  // Use @supabase/ssr so cookies are the canonical storage for sessions/PKCE.
  // Server-side should not auto-refresh tokens or persist sessions in-memory.
  // In Server Components, cookies().set() throws; no-op so getSession() still works (read-only).
  const setAll = createSecureSetAll((name, value, options) => {
    try {
      cookieStore.set(name, value, options);
    } catch {
      // Cookies can only be modified in a Server Action or Route Handler (Next.js).
      // In layouts/pages we only need to read; ignore write failures.
    }
  });

  return createSupabaseServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        setAll(
          cookiesToSet as {
            name: string;
            value: string;
            options?: Record<string, unknown>;
          }[]
        );
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};

/** Parse Cookie header into array of { name, value } for Supabase SSR. */
function parseCookieHeader(cookieHeader: string | null): { name: string; value: string }[] {
  if (!cookieHeader || !cookieHeader.trim()) return [];
  return cookieHeader.split(';').map((part) => {
    const eq = part.trim().indexOf('=');
    if (eq <= 0) return { name: part.trim(), value: '' };
    return {
      name: part.trim().slice(0, eq).trim(),
      value: part
        .trim()
        .slice(eq + 1)
        .trim(),
    };
  });
}

/**
 * Create a Supabase client that reads session from the request Cookie header.
 * Used when cookies() from next/headers may be empty (e.g. RSC request) but the
 * incoming request actually has cookies (e.g. navigation request had them).
 */
function createServerClientFromCookieHeader(cookieHeader: string | null) {
  const all = parseCookieHeader(cookieHeader);
  return createSupabaseServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll: () => all,
      setAll: () => {},
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
}

/**
 * Get current authenticated user on server
 * For Next.js 14, auth is primarily client-side
 * This function makes auth optional to prevent timeouts
 */
export const getServerUser = async (request?: Request) => {
  try {
    const supabaseAdmin = await getSupabaseAdmin();
    if (!supabaseAdmin) return null;

    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 5000));

    const authCheck = async () => {
      try {
        // Try Authorization header first; then cookie fallback (see cookie block below).
        // Empty "Authorization: Bearer " (no token after trim) is invalid — do not attempt validation.
        if (request) {
          const authHeader = request.headers.get('authorization');

          if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7).trim();
            if (!token) {
              // Bearer present but empty: fall through to cookies
            } else {
              const { hashToken } = await import('@/lib/utils/token-hash.server');
              const tokenHash = hashToken(token);
              const cached = getCachedAuthUser(tokenHash);
              if (cached) {
                return cached;
              }
              const supabaseAdminForToken = await getSupabaseAdmin();
              if (supabaseAdminForToken) {
                const {
                  data: { user },
                  error,
                } = await supabaseAdminForToken.auth.getUser(token);
                if (!error && user) {
                  setCachedAuthUser(tokenHash, user);
                  return user;
                }
              }
              // Bearer invalid: fall through to try cookies
            }
          }
        }

        // Prefer Cookie header; fallback to x-middleware-cookie (middleware forwards it so layouts see it).
        const cookieHeader =
          request?.headers.get('cookie') ?? request?.headers.get('x-middleware-cookie') ?? null;
        const hasCookieHeader = !!(cookieHeader && cookieHeader.length > 0);
        if (env.nodeEnv === 'development' && request) {
        }
        const supabase = hasCookieHeader
          ? createServerClientFromCookieHeader(cookieHeader)
          : await createServerClient();

        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();
        if (sessionError || !session?.access_token) {
          return null;
        }
        const {
          data: { user },
          error: userError,
        } = await supabaseAdmin.auth.getUser(session.access_token);
        if (!userError && user) {
          return user;
        }

        return null;
      } catch (err) {
        return null;
      }
    };

    return await Promise.race([authCheck(), timeout]);
  } catch (err) {
    return null;
  }
};

/** Profile shape returned from user_profiles (subset used for role checks). */
export type ServerUserProfileResult = {
  id: string;
  user_type: string;
  full_name: string | null;
  profile_media_id?: string | null;
  created_at?: string;
  updated_at?: string;
} | null;

/**
 * Get user profile on server
 * Uses admin client to bypass RLS policies. Results cached for CACHE_TTL_AUTH_MS.
 */
export const getServerUserProfile = async (userId: string): Promise<ServerUserProfileResult> => {
  const cached = getCachedProfile(userId);
  if (cached !== null) {
    return cached as ServerUserProfileResult;
  }

  const supabaseAdmin = await getSupabaseAdmin();
  if (!supabaseAdmin) {
    return null;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('id, user_type, full_name, profile_media_id, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error) {
      return null;
    }
    if (data) {
      setCachedProfile(userId, data);
    }
    return data;
  } catch (err) {
    return null;
  }
};
