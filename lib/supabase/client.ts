import { createClient } from '@supabase/supabase-js';
import { env } from '@/config/env';

/**
 * Client-side Supabase client
 * Configured for PKCE flow with proper session persistence
 */
export const supabase = createClient(env.supabase.url, env.supabase.anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: typeof window !== 'undefined' ? window.localStorage : undefined,
  },
});

