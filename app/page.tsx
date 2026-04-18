'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CusownPremiumLanding } from '@/components/marketing/cusown-premium-landing';
import { SplashScreen } from '@/components/ui/splash-screen';
import { ROUTES } from '@/lib/utils/navigation';

function getUserRoleCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const m = document.cookie.match(/(?:^|;\s*)cusown_user_role=([^;]*)/);
  return m ? decodeURIComponent(m[1]) : null;
}

function getDashboardForRole(role: string): string {
  switch (role) {
    case 'admin':
      return '/admin/dashboard';
    case 'owner':
      return '/owner/dashboard';
    default:
      return '/customer/dashboard';
  }
}

export default function Home() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [shouldRenderSplash, setShouldRenderSplash] = useState(false);

  useEffect(() => {
    const role = getUserRoleCookie();

    if (role) {
      router.replace(getDashboardForRole(role));
      return;
    }

    setShouldRenderSplash(true);

    const handlePageShow = (e: PageTransitionEvent) => {
      if (e.persisted) {
        const r = getUserRoleCookie();
        if (r) window.location.replace(getDashboardForRole(r));
      }
    };

    window.addEventListener('pageshow', handlePageShow);
    return () => window.removeEventListener('pageshow', handlePageShow);
  }, [router]);

  useEffect(() => {
    const error = searchParams?.get('error');
    const errorCode = searchParams?.get('error_code');
    const errorDesc = searchParams?.get('error_description');
    if (error || errorCode === 'bad_oauth_state' || errorDesc) {
      const msg = errorDesc || error || 'Sign-in was cancelled or expired. Please try again.';
      router.replace(
        `${typeof ROUTES.AUTH_LOGIN === 'function' ? ROUTES.AUTH_LOGIN() : '/auth/login'}?error=${encodeURIComponent(msg)}`
      );
    }
  }, [router, searchParams]);

  return (
    <>
      {shouldRenderSplash && <SplashScreen />}
      <CusownPremiumLanding />
    </>
  );
}
