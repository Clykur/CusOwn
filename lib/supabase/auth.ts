import { env } from '@/config/env';
import { createBrowserClient } from '@supabase/ssr';

/**
 * Client-side Supabase client for authentication
 * Use this in client components for login/logout
 */
const supabaseUrl = typeof window !== 'undefined' ? env.supabase.url || '' : '';
const supabaseAnonKey = typeof window !== 'undefined' ? env.supabase.anonKey || '' : '';

// Only create client if we have valid credentials
// Use a dummy client if credentials are missing to prevent crashes
let supabaseAuth: ReturnType<typeof createBrowserClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    // Cookie-based storage is required for SSR frameworks to reliably persist PKCE verifier.
    // This prevents "PKCE code verifier not found in storage" across redirects.
    supabaseAuth = createBrowserClient(supabaseUrl, supabaseAnonKey, {
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
        autoRefreshToken: true,
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
 * Get current authenticated user
 */
export const getCurrentUser = async () => {
  if (!supabaseAuth) return null;
  try {
    const {
      data: { user },
      error,
    } = await supabaseAuth.auth.getUser();
    if (error) return null;
    return user;
  } catch {
    return null;
  }
};

/**
 * Get user profile with role information
 */
export const getUserProfile = async (userId: string) => {
  if (!supabaseAuth) return null;
  try {
    // First check if we have a valid session
    const {
      data: { session },
    } = await supabaseAuth.auth.getSession();
    if (!session) return null;

    const { data, error } = await supabaseAuth
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // If error is "not found" (PGRST116), that's okay - profile doesn't exist yet
      if (error.code === 'PGRST116') {
        return null;
      }
      // For other errors, log in dev but return null
      if (process.env.NODE_ENV === 'development') {
        console.warn('Error fetching user profile:', error.message);
      }
      return null;
    }
    return data;
  } catch (error) {
    // Silently handle errors
    if (process.env.NODE_ENV === 'development') {
      console.warn('Exception fetching user profile:', error);
    }
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
 * Sign out
 */
export const signOut = async () => {
  if (!supabaseAuth) {
    return { error: null };
  }
  try {
    const { error } = await supabaseAuth.auth.signOut();
    return { error };
  } catch (error: any) {
    return { error };
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
