'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import { useEffect, useRef } from 'react';

const DEV = process.env.NODE_ENV === 'development';

function getFlowLabel(pathname: string, searchParams: URLSearchParams): string {
  if (pathname === '/auth/login') {
    const from = searchParams.get('redirect_from');
    const error = searchParams.get('error');
    if (error) return `Login page (error: ${decodeURIComponent(error).slice(0, 30)}...)`;
    if (from === 'guard') return 'Login page (redirected from auth guard — no session)';
    return 'Login page';
  }
  if (pathname.startsWith('/admin')) return `Admin flow — ${pathname}`;
  if (pathname.startsWith('/owner')) return `Owner flow — ${pathname}`;
  if (pathname.startsWith('/customer')) return `Customer flow — ${pathname}`;
  if (pathname === '/setup') return 'Setup flow';
  if (pathname === '/select-role') return 'Select role';
  if (pathname === '/') return 'Home';
  if (pathname.startsWith('/profile')) return `Profile — ${pathname}`;
  return pathname;
}

/**
 * Logs auth flow steps to the browser console in development for debugging redirect/session issues.
 */
export function AuthFlowDebug() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const prevPathRef = useRef<string | null>(null);

  useEffect(() => {
    if (!DEV || typeof window === 'undefined') return;
    const path = pathname ?? window.location.pathname;
    const params =
      searchParams?.toString() ??
      (typeof window !== 'undefined' ? window.location.search.slice(1) : '');
    const parsed = new URLSearchParams(params);
    const label = getFlowLabel(path, parsed);
    const fromGuard = parsed.get('redirect_from') === 'guard';
    if (prevPathRef.current !== path) {
      prevPathRef.current = path;
      console.log(
        '%c[AUTH_FLOW]',
        'background:#1a1a2e;color:#eee;padding:2px 6px;border-radius:4px;font-weight:bold',
        label
      );
      console.log('[AUTH_FLOW] pathname:', path, '| search:', params || '(none)');
      if (fromGuard) {
        console.log(
          '[AUTH_FLOW] You hit a protected route (e.g. /owner, /admin, /customer, /setup, /profile) without a valid session. This is normal if you are not logged in — sign in and try again.'
        );
        console.log(
          '[AUTH_FLOW] If you were already signed in: check the dev server terminal for "[AUTH] getServerUser" and "[AUTH] protected route request". If hasSupabaseAuthCookie is false, the browser may not be sending session cookies (e.g. cross-origin or cookie not set).'
        );
      }
    }
  }, [pathname, searchParams]);

  return null;
}
