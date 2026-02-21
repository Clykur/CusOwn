'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

const DEV = process.env.NODE_ENV === 'development';
import OwnerSidebar from '@/components/owner/owner-sidebar';
import MobileBottomNav from '@/components/owner/mobile-bottom-nav';
import OwnerHeader from '@/components/owner/owner-header';
import {
  OwnerSessionProvider,
  type OwnerInitialUser,
} from '@/components/owner/owner-session-context';
import { ROUTES } from '@/lib/utils/navigation';

type OwnerLayoutShellProps = {
  children: React.ReactNode;
  role: 'owner';
  initialUser?: OwnerInitialUser;
  requireClientAuthCheck?: boolean;
};

/**
 * Owner area shell. Auth from server or client session check when layout could not see cookies.
 */
export default function OwnerLayoutShell({
  children,
  role: _role,
  initialUser = null,
  requireClientAuthCheck = false,
}: OwnerLayoutShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clientUser, setClientUser] = useState<OwnerInitialUser | null>(null);
  const [clientCheckDone, setClientCheckDone] = useState(!requireClientAuthCheck);

  useEffect(() => {
    if (DEV && typeof window !== 'undefined') {
      console.log('[AUTH_FLOW] Owner dashboard shell mounted', {
        pathname,
        hasInitialUser: !!initialUser?.id,
        requireClientAuthCheck,
      });
    }
  }, [pathname, initialUser?.id, requireClientAuthCheck]);

  useEffect(() => {
    if (!requireClientAuthCheck) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/session', { credentials: 'include' });
        const json = await res.json();
        const data = json?.data ?? json;
        const user = data?.user ?? null;
        const profile = data?.profile ?? null;
        if (cancelled) return;
        if (!user) {
          const loginUrl =
            typeof ROUTES.AUTH_LOGIN === 'function'
              ? ROUTES.AUTH_LOGIN('/owner/dashboard')
              : '/auth/login';
          router.replace(`${loginUrl}?redirect_from=guard`);
          return;
        }
        setClientUser({
          id: user.id,
          email: user.email,
          full_name: (profile as { full_name?: string } | null)?.full_name ?? undefined,
        });
      } catch {
        if (!cancelled)
          router.replace(
            typeof ROUTES.AUTH_LOGIN === 'function' ? ROUTES.AUTH_LOGIN() : '/auth/login'
          );
      } finally {
        if (!cancelled) setClientCheckDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requireClientAuthCheck, router]);

  const user = initialUser ?? clientUser;

  if (requireClientAuthCheck && !clientCheckDone) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Checking authentication…</p>
      </div>
    );
  }

  if (requireClientAuthCheck && !user?.id) {
    return null;
  }

  const isDashboard = pathname === '/owner/dashboard';
  const isProfile = pathname === '/owner/profile';
  const isCreateBusiness = pathname === '/owner/setup';
  const mainSpacing = isProfile || isCreateBusiness ? 'lg:pl-12 lg:pr-12' : '';

  return (
    <OwnerSessionProvider initialUser={user ?? undefined}>
      <div className="min-h-screen bg-white flex overflow-x-hidden">
        <OwnerSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className={`flex-1 lg:ml-64 w-full ${mainSpacing}`}>
          <div className="px-4 sm:px-6 lg:px-12 xl:px-16 py-6 lg:py-8">
            {isDashboard && (
              <OwnerHeader title="Owner Dashboard" subtitle="Manage your businesses and bookings" />
            )}
            {children}
          </div>
        </main>
        <MobileBottomNav sidebarOpen={sidebarOpen} />
      </div>
    </OwnerSessionProvider>
  );
}
