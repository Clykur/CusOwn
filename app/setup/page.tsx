'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { API_ROUTES, BUSINESS_CATEGORIES_FALLBACK } from '@/config/constants';
import { getServerSessionClient } from '@/lib/auth/server-session-client';
import { ROUTES } from '@/lib/utils/navigation';
import { SetupSkeleton } from '@/components/ui/skeleton';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import CheckIcon from '@/src/icons/check.svg';
import BusinessesIcon from '@/src/icons/businesses.svg';
import InfoIcon from '@/src/icons/info.svg';
import CreateBusinessForm from '@/components/setup/create-business-form';
import { useSearchParams } from 'next/navigation';
import { fetchUserState } from '@/lib/utils/user-state.client';

export default function SetupPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [, setBusinessCategories] = useState<{ value: string; label: string }[]>(
    BUSINESS_CATEGORIES_FALLBACK
  );

  const searchParams = useSearchParams();
  const fromOnboarding = searchParams?.get('from') === 'onboarding';

  useEffect(() => {
    // Pre-fetch CSRF token
    getCSRFToken().catch(console.error);
  }, []);
  const checkAuthAndState = useCallback(async () => {
    const { user: sessionUser } = await getServerSessionClient();
    setUser(sessionUser ?? null);

    if (!sessionUser) {
      setCheckingAuth(false);
      return;
    }

    const stateResult = await fetchUserState();

    /**
     * RULES:
     * - Owners ARE allowed to access /setup to add more businesses
     * - Onboarding progress bar is shown ONLY for first-time flow
     */

    if (stateResult.businessCount === 0 && fromOnboarding) {
      // First business via onboarding
      setCheckingAuth(false);
      return;
    }

    // Logged-in owner adding another business
    setCheckingAuth(false);
  }, [fromOnboarding]);

  useEffect(() => {
    checkAuthAndState();
  }, [checkAuthAndState]);

  useEffect(() => {
    let cancelled = false;
    fetch(API_ROUTES.BUSINESS_CATEGORIES, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const list = res?.data && Array.isArray(res.data) ? res.data : [];
        setBusinessCategories(list.length ? list : BUSINESS_CATEGORIES_FALLBACK);
      })
      .catch(() => {
        if (!cancelled) setBusinessCategories(BUSINESS_CATEGORIES_FALLBACK);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Refresh state when tab becomes visible (handles tab switching)
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout | null = null;
    let isRefreshing = false;
    let lastRefreshTime = 0;
    const MIN_REFRESH_INTERVAL = 3000; // Don't refresh more than once per 3 seconds

    const refreshState = () => {
      const now = Date.now();
      if (isRefreshing || now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
        return;
      }

      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        isRefreshing = true;
        lastRefreshTime = Date.now();
        checkAuthAndState().finally(() => {
          isRefreshing = false;
        });
      }, 800); // Increased delay to reduce redundant calls
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshState();
      }
    };

    const handleFocus = () => {
      refreshState();
    };

    // Listen for storage events (when business is created in another tab)
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'business_created' || e.key === 'user_state_changed') {
        refreshState();
      }
    };

    // Listen for custom events (cross-tab communication)
    const handleCustomEvent = () => {
      refreshState();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('businessCreated', handleCustomEvent);
    window.addEventListener('userStateChanged', handleCustomEvent);

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('businessCreated', handleCustomEvent);
      window.removeEventListener('userStateChanged', handleCustomEvent);
    };
  }, [checkAuthAndState]);

  if (checkingAuth) {
    return <SetupSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 py-8 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-2xl shadow-xl p-8 md:p-10 mt-6 text-center">
            <div className="mb-8 flex justify-center">
              <div className="bg-black rounded-full p-6">
                <BusinessesIcon className="w-12 h-12 text-white" aria-hidden="true" />
              </div>
            </div>
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
              Sign In to Create Your Business
            </h1>
            <p className="text-gray-600 text-lg mb-8">
              Sign in with Google to create and manage your booking page. Your account will be
              created automatically.
            </p>
            <div className="space-y-4">
              <button
                onClick={() => router.push(ROUTES.AUTH_LOGIN(ROUTES.SETUP) + '&role=owner')}
                className="w-full bg-white border-2 border-gray-300 text-gray-700 font-semibold py-4 px-6 rounded-xl hover:bg-gray-50 hover:border-gray-400 transition-all flex items-center justify-center gap-3 shadow-md hover:shadow-lg"
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
              </button>
              <Link href={ROUTES.SELECT_ROLE('owner')}>
                <button className="w-full text-gray-600 hover:text-gray-900 text-sm font-medium transition-colors">
                  ← Back to Role Selection
                </button>
              </Link>
            </div>
            <div className="mt-8 bg-blue-50 border-l-4 border-blue-500 rounded-lg p-5 text-left">
              <p className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                <InfoIcon className="w-5 h-5" aria-hidden="true" />
                Why sign in?
              </p>
              <ul className="text-sm text-blue-800 space-y-2">
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  Secure access to your dashboard
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  Manage multiple businesses
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  View booking history & analytics
                </li>
                <li className="flex items-center gap-2">
                  <CheckIcon className="w-4 h-4 text-blue-600" aria-hidden="true" />
                  Switch between owner and customer roles
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  }
  return <CreateBusinessForm />;
}
