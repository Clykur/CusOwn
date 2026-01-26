import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { env } from '@/config/env';
import { userService } from '@/services/user.service';
import { getBaseUrl } from '@/lib/utils/url';
import { ROUTES } from '@/lib/utils/navigation';

/**
 * Handle OAuth callback from Google
 * This route is called after user authenticates with Google
 */
export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const cookieStore = await cookies();
  
  const baseUrl = getBaseUrl(request);

  if (code) {
    const supabase = createClient(env.supabase.url, env.supabase.anonKey, {
      auth: {
        flowType: 'pkce',
      },
    });
    
    // Exchange code for session
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.session && data.user) {
      // Set session cookies
      const maxAge = 100 * 365 * 24 * 60 * 60; // 100 years
      cookieStore.set('sb-access-token', data.session.access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge,
      });
      cookieStore.set('sb-refresh-token', data.session.refresh_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge,
      });

      // Get role from query params (set during role selection)
      const selectedRole = requestUrl.searchParams.get('role') as 'owner' | 'customer' | null;

      // Check existing profile FIRST to see if user is admin
      let profile;
      try {
        profile = await userService.getUserProfile(data.user.id);
        
          // If user is admin, redirect immediately - don't change their status
          if (profile?.user_type === 'admin') {
            return NextResponse.redirect(new URL(ROUTES.ADMIN_DASHBOARD, baseUrl));
          }
      } catch {
        // Profile might not exist yet, continue
      }

      // Ensure user profile exists (only if not admin)
      try {
        if (!profile) {
          // Create profile with selected role or default to customer
          const userType = selectedRole || 'customer';
          profile = await userService.upsertUserProfile(data.user.id, {
            full_name: data.user.user_metadata?.full_name || data.user.email?.split('@')[0] || null,
            user_type: userType,
          });
        } else if (selectedRole && profile.user_type !== 'admin') {
          // Update existing profile if role was selected (but never change admin)
          const currentType = profile.user_type;
          let newType: 'owner' | 'customer' | 'both' | 'admin' = selectedRole;
          
          if (currentType === 'owner' && selectedRole === 'customer') {
            newType = 'both';
          } else if (currentType === 'customer' && selectedRole === 'owner') {
            newType = 'both';
          } else if (currentType === 'both') {
            newType = 'both'; // Keep 'both' if already set
          }
          
          if (newType !== currentType) {
            profile = await userService.updateUserType(data.user.id, newType);
          }
        }
      } catch (profileError) {
        // Continue anyway - profile can be created later
        try {
          profile = await userService.getUserProfile(data.user.id);
          // Double-check admin status after profile creation
          if (profile?.user_type === 'admin') {
            return NextResponse.redirect(new URL(ROUTES.ADMIN_DASHBOARD, baseUrl));
          }
        } catch {
          profile = null;
        }
      }

      // Final check if user is admin - admins go directly to admin dashboard
      if (profile?.user_type === 'admin') {
        return NextResponse.redirect(new URL(ROUTES.ADMIN_DASHBOARD, baseUrl));
      }

      // Redirect based on role
      const redirectTo = requestUrl.searchParams.get('redirect_to');
      
      // If redirect_to is set and it's not the callback itself, use it
      if (redirectTo && !redirectTo.includes('/auth/callback')) {
        // Ensure redirect_to uses the correct base URL
        const redirectUrl = redirectTo.startsWith('http') 
          ? redirectTo 
          : new URL(redirectTo, baseUrl).toString();
        return NextResponse.redirect(redirectUrl);
      }

      // Use canonical user state system for redirects
      const { getUserState } = await import('@/lib/utils/user-state');
      const stateResult = await getUserState(data.user.id);
      
      // If state system provides a redirect URL, use it
      if (stateResult.redirectUrl) {
        return NextResponse.redirect(new URL(stateResult.redirectUrl, baseUrl));
      }
      
      // Fallback: Default redirects based on selected role
      if (selectedRole === 'owner') {
        // Will be handled by state system, but fallback to setup
        return NextResponse.redirect(new URL(ROUTES.SETUP, baseUrl));
      } else if (selectedRole === 'customer') {
        return NextResponse.redirect(new URL(ROUTES.CUSTOMER_DASHBOARD, baseUrl));
      } else {
        // Default to customer dashboard
        return NextResponse.redirect(new URL(ROUTES.CUSTOMER_DASHBOARD, baseUrl));
      }
    }
  }

  // If error or no code, redirect to home
  // baseUrl is already defined at the top of the function
  return NextResponse.redirect(new URL(ROUTES.HOME, baseUrl));
}

