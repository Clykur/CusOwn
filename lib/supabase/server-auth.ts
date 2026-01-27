import { env } from '@/config/env';
import { createServerClient as createSupabaseServerClient } from '@supabase/ssr';

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
  return createSupabaseServerClient(env.supabase.url, env.supabase.anonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  });
};

/**
 * Get current authenticated user on server
 * For Next.js 14, auth is primarily client-side
 * This function makes auth optional to prevent timeouts
 */
export const getServerUser = async (request?: Request) => {
  const DEBUG = process.env.NODE_ENV === 'development';
  
  try {
    // Check if Supabase is configured
    const supabaseAdmin = await getSupabaseAdmin();
    if (!supabaseAdmin) {
      if (DEBUG) console.log('[getServerUser] Supabase admin client not configured');
      return null;
    }

    // Add timeout to prevent hanging
    const timeout = new Promise<null>((resolve) => 
      setTimeout(() => {
        if (DEBUG) console.log('[getServerUser] Auth check timed out after 2 seconds');
        resolve(null);
      }, 2000)
    );

    const authCheck = async () => {
      try {
        // Try to get user from Authorization header first
        if (request) {
          const authHeader = request.headers.get('authorization');
          if (DEBUG) console.log('[getServerUser] Authorization header:', authHeader ? 'present' : 'missing');
          
          if (authHeader?.startsWith('Bearer ')) {
            const token = authHeader.substring(7);
            if (DEBUG) console.log('[getServerUser] Bearer token found, validating...');
            
            const supabaseAdmin = await getSupabaseAdmin();
            if (!supabaseAdmin) {
              if (DEBUG) console.log('[getServerUser] Supabase admin not configured');
              return null;
            }
            const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
            if (error) {
              if (DEBUG) console.log('[getServerUser] Bearer token validation error:', error.message);
            } else if (user) {
              if (DEBUG) console.log('[getServerUser] User authenticated via Bearer token:', user.email);
              return user;
            }
          }
        } else {
          if (DEBUG) console.log('[getServerUser] No request object provided');
        }

        // Try to get user from cookies (set by auth callback)
        try {
          const cookieStore = await getCookies();
          const projectRef = env.supabase.url.split('//')[1]?.split('.')[0] || '';
          
          // Check for access token in cookies
          const accessTokenKey = `sb-${projectRef}-auth-token`;
          const accessToken = cookieStore.get(accessTokenKey)?.value;
          const sessionAccessToken = cookieStore.get('sb-access-token')?.value;
          
          if (DEBUG) {
            console.log('[getServerUser] Cookie check:', {
              hasAccessToken: !!accessToken,
              hasSessionToken: !!sessionAccessToken,
              cookieKey: accessTokenKey,
            });
          }
          
          if (accessToken) {
            if (DEBUG) console.log('[getServerUser] Validating Supabase cookie token...');
            const supabaseAdmin = await getSupabaseAdmin();
            if (!supabaseAdmin) {
              if (DEBUG) console.log('[getServerUser] Supabase admin not configured');
              return null;
            }
            const { data: { user }, error } = await supabaseAdmin.auth.getUser(accessToken);
            if (error) {
              if (DEBUG) console.log('[getServerUser] Supabase cookie validation error:', error.message);
            } else if (user) {
              if (DEBUG) console.log('[getServerUser] User authenticated via Supabase cookie:', user.email);
              return user;
            }
          }

          // Also check for the session cookies we set in callback
          if (sessionAccessToken) {
            if (DEBUG) console.log('[getServerUser] Validating session cookie token...');
            const supabaseAdmin = await getSupabaseAdmin();
            if (!supabaseAdmin) {
              if (DEBUG) console.log('[getServerUser] Supabase admin not configured');
              return null;
            }
            const { data: { user }, error } = await supabaseAdmin.auth.getUser(sessionAccessToken);
            if (error) {
              if (DEBUG) console.log('[getServerUser] Session cookie validation error:', error.message);
            } else if (user) {
              if (DEBUG) console.log('[getServerUser] User authenticated via session cookie:', user.email);
              return user;
            }
          }
          
          if (DEBUG && !accessToken && !sessionAccessToken) {
            console.log('[getServerUser] No auth cookies found');
          }
        } catch (cookieError) {
          if (DEBUG) console.log('[getServerUser] Cookie check error:', cookieError instanceof Error ? cookieError.message : 'Unknown');
        }

        if (DEBUG) console.log('[getServerUser] No user found');
        return null;
      } catch (error) {
        if (DEBUG) console.log('[getServerUser] Auth check error:', error instanceof Error ? error.message : 'Unknown');
        return null;
      }
    };

    return await Promise.race([authCheck(), timeout]);
  } catch (error) {
    if (DEBUG) console.log('[getServerUser] Fatal error:', error instanceof Error ? error.message : 'Unknown');
    // Graceful failure - return null if auth check fails
    // This allows the app to work without blocking on auth
    return null;
  }
};

/**
 * Get user profile on server
 * Uses admin client to bypass RLS policies
 */
export const getServerUserProfile = async (userId: string) => {
  const DEBUG = process.env.NODE_ENV === 'development';
  
  const supabaseAdmin = await getSupabaseAdmin();
  if (!supabaseAdmin) {
    if (DEBUG) console.log('[getServerUserProfile] Supabase admin client not configured');
    return null;
  }

  try {
    if (DEBUG) console.log('[getServerUserProfile] Fetching profile for user:', userId);
    
    const { data, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();
    
    if (error) {
      if (DEBUG) console.log('[getServerUserProfile] Error fetching profile:', error.message, error.code);
      return null;
    }
    
    if (DEBUG) console.log('[getServerUserProfile] Profile found:', data ? { user_type: data.user_type } : 'null');
    return data;
  } catch (error) {
    if (DEBUG) console.log('[getServerUserProfile] Exception:', error instanceof Error ? error.message : 'Unknown');
    return null;
  }
};

