'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ROUTES } from '@/lib/utils/navigation';
import { PublicHeader } from '@/components/layout/public-header';

const DEV = process.env.NODE_ENV === 'development';

/** Build server auth URL: frontend only navigates; auth is done server-side via /api/auth/login. */
function buildLoginUrl(redirectTo: string, role: 'owner' | 'customer' | null): string {
  const params = new URLSearchParams();
  if (redirectTo && redirectTo !== '/') params.set('redirect_to', redirectTo);
  if (role) params.set('role', role);
  const q = params.toString();
  return `/api/auth/login${q ? `?${q}` : ''}`;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const error = searchParams?.get('error');
  const redirectFrom = searchParams?.get('redirect_from');

  const redirectTo = searchParams?.get('redirect_to') || '/';
  const role = (searchParams?.get('role') as 'owner' | 'customer' | null) ?? null;
  const loginUrl = buildLoginUrl(redirectTo, role);

  useEffect(() => {
    if (!DEV) return;
    console.log('[AUTH_FLOW] Login page loaded', {
      redirect_to: redirectTo,
      role,
      error: error ? decodeURIComponent(error).slice(0, 50) : null,
      redirect_from: redirectFrom ?? null,
    });
  }, [redirectTo, role, error, redirectFrom]);

  const handleClickLogin = () => {
    if (DEV) {
      console.log('[AUTH_FLOW] User clicked Continue with Google — navigating to', loginUrl);
    }
  };

  const getRoleContext = () => {
    if (role === 'owner') {
      return {
        title: 'Sign In to Create Your Business',
        description: 'Create your booking page and start accepting appointments from customers.',
        icon: (
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
            />
          </svg>
        ),
      };
    } else if (role === 'customer') {
      return {
        title: 'Sign In to Book Appointments',
        description: 'Access your bookings and book new appointments easily.',
        icon: (
          <svg className="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
          </svg>
        ),
      };
    }
    return {
      title: 'Sign In to Continue',
      description: 'Sign in with Google to access your account.',
      icon: null,
    };
  };

  const context = getRoleContext();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <PublicHeader />
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            {context.icon && (
              <div className="mb-4 flex justify-center">
                <div className="bg-gray-100 rounded-full p-4">{context.icon}</div>
              </div>
            )}
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{context.title}</h1>
            <p className="text-gray-600">{context.description}</p>
          </div>

          {error && (
            <div className="mb-4 bg-gray-100 border border-gray-300 text-black px-4 py-3 rounded-lg">
              {decodeURIComponent(error)}
            </div>
          )}

          <a
            href={loginUrl}
            onClick={handleClickLogin}
            className="w-full bg-white border-2 border-gray-300 text-gray-700 font-semibold py-3 px-6 rounded-lg hover:bg-gray-50 transition-colors flex items-center justify-center gap-3"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path
                fill="currentColor"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="currentColor"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="currentColor"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="currentColor"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            Continue with Google
          </a>

          <p className="mt-6 text-center text-sm text-gray-500">
            By signing in, you agree to our terms of service and privacy policy
          </p>

          <button
            onClick={() => router.push(ROUTES.HOME)}
            className="mt-4 w-full text-gray-600 hover:text-gray-900 text-sm"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-white flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
