import { env } from '@/config/env';
import { createBrowserClient } from '@supabase/ssr';
import { AUTH_COOKIE_MAX_AGE_SECONDS } from '@/config/constants';

/**
 * Client-side Supabase client for authentication
 * Use this in client components for login/logout
 * Refresh is throttled by global fetch patch (see layout.tsx script).
 */
const supabaseUrl = typeof window !== 'undefined' ? env.supabase.url || '' : '';
const supabaseAnonKey = typeof window !== 'undefined' ? env.supabase.anonKey || '' : '';

// Only create client if we have valid credentials
// Use a dummy client if credentials are missing to prevent crashes
let supabaseAuth: ReturnType<typeof createBrowserClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseAuth = createBrowserClient(supabaseUrl, supabaseAnonKey, {
      cookies: {
        get(name) {
          if (typeof document === 'undefined') return undefined;
          const cookies = document.cookie.split(';').map((c) => c.trim());
          const match = cookies.find((c) => c.startsWith(`${name}=`));
          return match ? decodeURIComponent(match.split('=').slice(1).join('=')) : undefined;
        },
        // Auth/session cookies are set only server-side. No client writes to prevent XSS stealing.
        set(name, _value, _options) {
          if (typeof document === 'undefined') return;
          const n = name.toLowerCase();
          if (n.startsWith('sb-') || n.includes('auth') || n.includes('session')) return;
          const opts = _options ?? {};
          const maxAge =
            opts.maxAge ?? (n.includes('auth') ? AUTH_COOKIE_MAX_AGE_SECONDS : undefined);
          const parts = [`${name}=${encodeURIComponent(_value)}`];
          parts.push(`Path=${opts.path ?? '/'}`);
          if (maxAge != null) parts.push(`Max-Age=${maxAge}`);
          if (opts.expires) parts.push(`Expires=${(opts.expires as Date).toUTCString()}`);
          if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
          if (opts.secure) parts.push('Secure');
          document.cookie = parts.join('; ');
        },
        remove(name, _options) {
          if (typeof document === 'undefined') return;
          const n = name.toLowerCase();
          if (n.startsWith('sb-') || n.includes('auth') || n.includes('session')) return;
          const opts = _options ?? {};
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
    console.error('Failed to initialize Supabase client:', error);
    supabaseAuth = null;
  }
}

export { supabaseAuth };

/**
 * Get current authenticated user. Client: server-only via /api/auth/session.
 */
export const getCurrentUser = async () => {
  if (typeof window === 'undefined') return null;
  try {
    const { getServerSessionClient } = await import('@/lib/auth/server-session-client');
    const { user } = await getServerSessionClient();
    return user;
  } catch {
    return null;
  }
};

/**
 * Get user profile with role information. Client: server-only via /api/auth/session.
 */
export const getUserProfile = async (userId: string) => {
  if (typeof window === 'undefined') return null;
  try {
    const { getServerSessionClient } = await import('@/lib/auth/server-session-client');
    const { user, profile } = await getServerSessionClient();
    if (!user || user.id !== userId) return null;
    return profile;
  } catch {
    return null;
  }
};

import { getOAuthRedirect } from '@/lib/auth/getOAuthRedirect';

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (redirectTo?: string) => {
  if (!supabaseAuth) {
    return { data: null, error: { message: 'Supabase not configured' } };
  }
  try {
    let baseUrl = redirectTo || getOAuthRedirect('/auth/callback');

    if (typeof window !== 'undefined' && window.location?.origin) {
      const currentOrigin = window.location.origin;
      try {
        const parsed = new URL(baseUrl);
        if (parsed.origin !== currentOrigin) {
          baseUrl = `${currentOrigin}${parsed.pathname}${parsed.search}`;
        }
      } catch {
        baseUrl = `${currentOrigin}/auth/callback`;
      }
    }

    if (
      process.env.NODE_ENV === 'development' &&
      typeof window !== 'undefined' &&
      window.location?.origin
    ) {
      const redirectOrigin = new URL(baseUrl).origin;
      if (redirectOrigin !== window.location.origin) {
        throw new Error(
          `OAuth redirect must match current origin (dev guard). Current: ${window.location.origin}, redirect: ${redirectOrigin}`
        );
      }
    }

    const { data, error } = await supabaseAuth.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: baseUrl,
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });

    return { data, error };
  } catch (error: any) {
    return { data: null, error };
  }
};

/**
 * Sign out: server-only. Redirects to /api/auth/signout so server clears session.
 */
export const signOut = async () => {
  if (typeof window === 'undefined') return { error: null };
  try {
    const { clearServerSessionCache } = await import('@/lib/auth/server-session-client');
    clearServerSessionCache();
    window.location.href = '/api/auth/signout';
    return { error: null };
  } catch (error: unknown) {
    return { error: error as { message?: string } };
  }
};

/**
 * Check if user is owner
 */
export const isOwner = async (userId: string): Promise<boolean> => {
  const profile = await getUserProfile(userId);
  if (!profile) return false;
  const userType = (profile as any).user_type;
  return userType === 'owner' || userType === 'both' || userType === 'admin';
};

/**
 * Check if user is customer
 */
export const isCustomer = async (userId: string): Promise<boolean> => {
  const profile = await getUserProfile(userId);
  if (!profile) return true; // Default to customer
  const userType = (profile as any).user_type;
  return userType === 'customer' || userType === 'both' || userType === 'admin';
};

/**
 * Check if user is admin
 */
export const isAdmin = async (userId: string): Promise<boolean> => {
  const profile = await getUserProfile(userId);
  if (!profile) return false;
  return (profile as any).user_type === 'admin';
};
