import { createClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

/**
 * Client-side Supabase client for authentication
 * Use this in client components for login/logout
 */
const supabaseUrl = typeof window !== 'undefined' ? (env.supabase.url || '') : '';
const supabaseAnonKey = typeof window !== 'undefined' ? (env.supabase.anonKey || '') : '';

// Only create client if we have valid credentials
// Use a dummy client if credentials are missing to prevent crashes
let supabaseAuth: ReturnType<typeof createClient> | null = null;

if (supabaseUrl && supabaseAnonKey) {
  try {
    supabaseAuth = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
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
    const { data: { user }, error } = await supabaseAuth.auth.getUser();
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
    const { data: { session } } = await supabaseAuth.auth.getSession();
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

import { getClientBaseUrl } from '@/lib/utils/url';

const getOAuthBaseUrl = (): string => {
  return getClientBaseUrl();
};

/**
 * Sign in with Google
 */
export const signInWithGoogle = async (redirectTo?: string) => {
  if (!supabaseAuth) {
    return { data: null, error: { message: 'Supabase not configured' } };
  }
  try {
    // Use the provided redirectTo or construct from base URL
    const baseUrl = redirectTo || `${getOAuthBaseUrl()}/auth/callback`;
    
    const { data, error } = await supabaseAuth.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: baseUrl,
        // Force PKCE flow (more secure, tokens not in URL)
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

