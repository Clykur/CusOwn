import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

/**
 * Server-side Supabase admin client
 * Only creates client if credentials are available
 */
let supabaseAdminInstance: SupabaseClient | null = null;

const createSupabaseAdmin = (): SupabaseClient | null => {
  // Check environment variables directly to ensure they're loaded
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || env.supabase.url?.trim();
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || env.supabase.serviceRoleKey?.trim();

  if (!url || !serviceRoleKey || url === '' || serviceRoleKey === '') {
    // Only warn in development and if we're actually missing values
    // Check if we're in Node.js environment (not browser)
    const isServer = typeof window === 'undefined';
    if (process.env.NODE_ENV === 'development' && isServer) {
      console.warn(
        '⚠️  Supabase credentials not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
      );
    }
    return null;
  }

  try {
    return createClient(url, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  } catch (error) {
    // In development, log the error
    if (process.env.NODE_ENV === 'development') {
      console.error('Failed to create Supabase admin client:', error);
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
  if (process.env.NODE_ENV === 'development') {
    console.error('Supabase admin client initialization failed:', error);
  }
}

// Export the client - will be null if credentials are missing
// Services should check for null before using
export const supabaseAdmin = supabaseAdminInstance;

/**
 * Helper to ensure Supabase is configured
 * Throws a clear error if not configured
 */
export const requireSupabaseAdmin = (): SupabaseClient => {
  if (!supabaseAdmin) {
    throw new Error(
      'Supabase is not configured. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your .env.local file.'
    );
  }
  return supabaseAdmin;
};
