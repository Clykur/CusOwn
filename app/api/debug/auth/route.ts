import { NextRequest } from 'next/server';
import { cookies } from 'next/headers';
import { env } from '@/config/env';
import { supabaseAdmin } from '@/lib/supabase/server';
import { successResponse, errorResponse } from '@/lib/utils/response';

/**
 * Debug endpoint to check authentication status
 * GET /api/debug/auth
 * This helps diagnose authentication issues
 */
export async function GET(request: NextRequest) {
  const debugInfo: any = {
    timestamp: new Date().toISOString(),
    supabaseConfigured: !!supabaseAdmin,
    hasRequest: !!request,
    headers: {},
    cookies: {},
    authMethods: [],
    errors: [],
  };

  try {
    // Check environment
    debugInfo.env = {
      hasSupabaseUrl: !!env.supabase.url,
      hasAnonKey: !!env.supabase.anonKey,
      hasServiceKey: !!env.supabase.serviceRoleKey,
      supabaseUrl: env.supabase.url ? `${env.supabase.url.substring(0, 20)}...` : 'missing',
    };

    // Check Authorization header
    const authHeader = request.headers.get('authorization');
    debugInfo.headers.authorization = authHeader ? `${authHeader.substring(0, 20)}...` : 'missing';
    
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      debugInfo.authMethods.push('Bearer token found in header');
      
      try {
        if (supabaseAdmin) {
          const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
          if (error) {
            debugInfo.errors.push(`Bearer token validation error: ${error.message}`);
          } else if (user) {
            debugInfo.authMethods.push('Bearer token validated successfully');
            debugInfo.user = {
              id: user.id,
              email: user.email,
              emailVerified: user.email_confirmed_at ? true : false,
            };
          }
        }
      } catch (error) {
        debugInfo.errors.push(`Bearer token check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Check cookies
    try {
      const cookieStore = await cookies();
      const projectRef = env.supabase.url.split('//')[1]?.split('.')[0] || '';
      const accessTokenKey = `sb-${projectRef}-auth-token`;
      const sessionAccessToken = cookieStore.get('sb-access-token')?.value;
      const supabaseToken = cookieStore.get(accessTokenKey)?.value;

      debugInfo.cookies = {
        'sb-access-token': sessionAccessToken ? `${sessionAccessToken.substring(0, 20)}...` : 'missing',
        [accessTokenKey]: supabaseToken ? `${supabaseToken.substring(0, 20)}...` : 'missing',
        allCookies: Array.from(cookieStore.getAll().map(c => c.name)),
      };

      if (sessionAccessToken) {
        debugInfo.authMethods.push('sb-access-token cookie found');
        try {
          if (supabaseAdmin) {
            const { data: { user }, error } = await supabaseAdmin.auth.getUser(sessionAccessToken);
            if (error) {
              debugInfo.errors.push(`Session cookie validation error: ${error.message}`);
            } else if (user) {
              debugInfo.authMethods.push('Session cookie validated successfully');
              if (!debugInfo.user) {
                debugInfo.user = {
                  id: user.id,
                  email: user.email,
                  emailVerified: user.email_confirmed_at ? true : false,
                };
              }
            }
          }
        } catch (error) {
          debugInfo.errors.push(`Session cookie check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }

      if (supabaseToken) {
        debugInfo.authMethods.push(`Supabase cookie (${accessTokenKey}) found`);
        try {
          if (supabaseAdmin) {
            const { data: { user }, error } = await supabaseAdmin.auth.getUser(supabaseToken);
            if (error) {
              debugInfo.errors.push(`Supabase cookie validation error: ${error.message}`);
            } else if (user) {
              debugInfo.authMethods.push('Supabase cookie validated successfully');
              if (!debugInfo.user) {
                debugInfo.user = {
                  id: user.id,
                  email: user.email,
                  emailVerified: user.email_confirmed_at ? true : false,
                };
              }
            }
          }
        } catch (error) {
          debugInfo.errors.push(`Supabase cookie check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      }
    } catch (cookieError) {
      debugInfo.errors.push(`Cookie check failed: ${cookieError instanceof Error ? cookieError.message : 'Unknown error'}`);
    }

    // If we have a user, try to get their profile
    if (debugInfo.user && supabaseAdmin) {
      try {
        const { data: profile, error: profileError } = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('id', debugInfo.user.id)
          .single();
        
        if (profileError) {
          debugInfo.errors.push(`Profile fetch error: ${profileError.message}`);
        } else {
          debugInfo.user.profile = {
            user_type: profile?.user_type,
            full_name: profile?.full_name,
            is_admin: profile?.user_type === 'admin',
          };
        }
      } catch (error) {
        debugInfo.errors.push(`Profile check failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Summary
    debugInfo.summary = {
      authenticated: !!debugInfo.user,
      hasProfile: !!debugInfo.user?.profile,
      isAdmin: debugInfo.user?.profile?.is_admin || false,
      authMethodUsed: debugInfo.authMethods.length > 0 ? debugInfo.authMethods[debugInfo.authMethods.length - 1] : 'none',
      hasErrors: debugInfo.errors.length > 0,
    };

    return successResponse(debugInfo, 'Debug information retrieved');
  } catch (error) {
    debugInfo.errors.push(`Debug endpoint error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return successResponse(debugInfo, 'Debug information retrieved (with errors)');
  }
}

