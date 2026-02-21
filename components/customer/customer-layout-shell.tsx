'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import CustomerHeader from '@/components/customer/customer-header';
import CustomerSidebar from '@/components/customer/customer-sidebar';
import CustomerMobileBottomNav from '@/components/customer/mobile-bottom-nav';
import {
  CustomerSessionProvider,
  type CustomerInitialUser,
} from '@/components/customer/customer-session-context';
import { ROUTES } from '@/lib/utils/navigation';

const DEV = process.env.NODE_ENV === 'development';

type CustomerLayoutShellProps = {
  children: React.ReactNode;
  role: 'customer';
  initialUser?: CustomerInitialUser;
  requireClientAuthCheck?: boolean;
};

/**
 * Customer area shell. Auth from server or client session check when layout could not see cookies.
 */
export default function CustomerLayoutShell({
  children,
  role: _role,
  initialUser = null,
  requireClientAuthCheck = false,
}: CustomerLayoutShellProps) {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [clientUser, setClientUser] = useState<CustomerInitialUser | null>(null);
  const [clientCheckDone, setClientCheckDone] = useState(!requireClientAuthCheck);

  useEffect(() => {
    if (DEV && typeof window !== 'undefined') {
      console.log('[AUTH_FLOW] Customer dashboard shell mounted', {
        hasInitialUser: !!initialUser?.id,
        requireClientAuthCheck,
      });
    }
  }, [initialUser?.id, requireClientAuthCheck]);

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
              ? ROUTES.AUTH_LOGIN('/customer/dashboard')
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

  return (
    <CustomerSessionProvider initialUser={user ?? undefined}>
      <div className="min-h-screen bg-white flex overflow-x-hidden">
        <CustomerSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 lg:ml-64">
          <div className="px-4 sm:px-6 lg:px-8 py-8 lg:pl-0">
            <CustomerHeader title="My Bookings" subtitle="Manage your bookings and appointments" />
            {children}
          </div>
        </main>
        <CustomerMobileBottomNav sidebarOpen={sidebarOpen} />
      </div>
    </CustomerSessionProvider>
  );
}
