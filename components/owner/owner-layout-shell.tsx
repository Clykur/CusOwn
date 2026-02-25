'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
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
  const safePathname = pathname ?? '';
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clientUser, setClientUser] = useState<OwnerInitialUser | null>(null);
  const [clientCheckDone, setClientCheckDone] = useState(!requireClientAuthCheck);
  /** When true, session was missing after client check; user stays in flow until they click Sign in or Logout. */
  const [sessionMissing, setSessionMissing] = useState(false);

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
          setSessionMissing(true);
          setClientCheckDone(true);
          return;
        }
        setClientUser({
          id: user.id,
          email: user.email,
          full_name: (profile as { full_name?: string } | null)?.full_name ?? undefined,
        });
      } catch {
        if (!cancelled) {
          setSessionMissing(true);
        }
      } finally {
        if (!cancelled) setClientCheckDone(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [requireClientAuthCheck, router]);

  const user = initialUser ?? clientUser;
  const loginUrl =
    typeof ROUTES.AUTH_LOGIN === 'function' ? ROUTES.AUTH_LOGIN('/owner/dashboard') : '/auth/login';

  if (requireClientAuthCheck && !clientCheckDone) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <p className="text-gray-500">Checking authentication…</p>
      </div>
    );
  }

  if (requireClientAuthCheck && sessionMissing) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center max-w-sm px-4">
          <p className="text-gray-600 mb-4">
            Your session may have expired. Sign in again to continue.
          </p>
          <a
            href={loginUrl}
            className="inline-block text-brand-600 hover:text-brand-700 font-medium"
          >
            Sign in again
          </a>
        </div>
      </div>
    );
  }

  const isDashboard = safePathname === '/owner/dashboard';
  const isProfile = safePathname === '/owner/profile';
  const isCreateBusiness = safePathname === '/owner/setup';
  const isBusinesses = safePathname === '/owner/businesses';
  const isBusinessDetail =
    safePathname.startsWith('/owner/') &&
    safePathname !== '/owner/dashboard' &&
    safePathname !== '/owner/setup' &&
    safePathname !== '/owner/businesses' &&
    safePathname !== '/owner/profile' &&
    safePathname.split('/').filter(Boolean).length === 2;
  const isOwnerMainArea =
    isDashboard || isCreateBusiness || isBusinesses || isBusinessDetail || isProfile;
  const mainSpacing = '';

  return (
    <OwnerSessionProvider initialUser={user ?? undefined}>
      <div className="min-h-screen bg-white flex overflow-x-hidden">
        <OwnerSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className={`flex-1 lg:ml-64 w-full ${mainSpacing}`}>
          {isOwnerMainArea ? (
            <div className="mx-auto w-full max-w-[1200px] py-8 px-6 sm:px-8 lg:px-10">
              <div className="flex flex-col gap-6">
                {isDashboard && (
                  <OwnerHeader
                    title="Owner Dashboard"
                    subtitle="Manage your businesses and bookings"
                  />
                )}
                {isCreateBusiness && (
                  <OwnerHeader
                    title="Create Business"
                    subtitle="Add a new business to your account"
                  />
                )}
                {isBusinesses && (
                  <OwnerHeader title="My Businesses" subtitle="View and manage your businesses" />
                )}
                {isProfile && (
                  <OwnerHeader title="My Profile" subtitle="Manage your account and preferences" />
                )}
                {children}
              </div>
            </div>
          ) : (
            <div className="px-4 sm:px-6 lg:px-12 xl:px-16 py-6 lg:py-8">{children}</div>
          )}
        </main>
        <MobileBottomNav sidebarOpen={sidebarOpen} />
      </div>
    </OwnerSessionProvider>
  );
}
