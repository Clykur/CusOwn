'use client';

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseAuth } from '@/lib/supabase/auth';

/**
 * Client-side OAuth callback handler
 * Processes tokens from URL hash and redirects appropriately
 */
function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Check if we have a code (PKCE flow)
        const code = searchParams.get('code');
        
        if (code) {
          // PKCE flow - exchange code for session
          if (!supabaseAuth) {
            console.error('Supabase not configured');
            router.push('/auth/login?error=config');
            return;
          }

          const { data, error } = await supabaseAuth.auth.exchangeCodeForSession(code);
          
          if (error) {
            console.error('Session exchange error:', error);
            router.push(`/auth/login?error=${encodeURIComponent(error.message)}`);
            return;
          }

          if (data.session) {
            // Session created successfully - redirect to server callback to handle profile/redirect logic
            const role = searchParams.get('role');
            const redirectTo = searchParams.get('redirect_to');
            
            let callbackUrl = '/auth/callback/process';
            const params = new URLSearchParams();
            if (role) params.set('role', role);
            if (redirectTo) params.set('redirect_to', redirectTo);
            if (params.toString()) {
              callbackUrl += '?' + params.toString();
            }
            
            router.push(callbackUrl);
            return;
          }
        }

        // Check for tokens in hash (implicit flow - should not happen with PKCE)
        const hash = window.location.hash.substring(1);
        if (hash) {
          const hashParams = new URLSearchParams(hash);
          const accessToken = hashParams.get('access_token');
          const refreshToken = hashParams.get('refresh_token');
          
          if (accessToken && supabaseAuth) {
            // Set session from hash tokens
            const { data: sessionData, error: sessionError } = await supabaseAuth.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken || '',
            });

            if (sessionError) {
              console.error('Session error:', sessionError);
              router.push('/auth/login?error=session');
              return;
            }

            if (sessionData.session) {
              // Clear the hash from URL immediately to prevent token exposure
              const cleanUrl = window.location.pathname + (window.location.search || '');
              window.history.replaceState(null, '', cleanUrl);
              
              // Small delay to ensure URL is cleaned before redirect
              await new Promise(resolve => setTimeout(resolve, 100));
              
              // Redirect to server callback to handle profile/redirect logic
              const role = searchParams.get('role');
              const redirectTo = searchParams.get('redirect_to');
              
              let callbackUrl = '/auth/callback/process';
              const params = new URLSearchParams();
              if (role) params.set('role', role);
              if (redirectTo) params.set('redirect_to', redirectTo);
              if (params.toString()) {
                callbackUrl += '?' + params.toString();
              }
              
              router.push(callbackUrl);
              return;
            }
          }
        }

        // No code or tokens found - redirect to login
        router.push('/auth/login?error=no_token');
      } catch (error) {
        console.error('Callback error:', error);
        router.push('/auth/login?error=callback_failed');
      }
    };

    handleCallback();
  }, [router, searchParams]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
        <p className="text-gray-600">Completing sign in...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}
