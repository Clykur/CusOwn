'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import CustomerHeader from '@/components/customer/customer-header';
import CustomerSidebar from '@/components/customer/customer-sidebar';
import CustomerMobileBottomNav from '@/components/customer/mobile-bottom-nav';
import {
  CustomerSessionProvider,
  type CustomerInitialUser,
} from '@/components/customer/customer-session-context';
import { ROUTES } from '@/lib/utils/navigation';
import { UI_CUSTOMER } from '@/config/constants';
import { env } from '@/config/env';

function getCustomerHeader(pathname: string): {
  title: string;
  subtitle: string;
} {
  if (pathname === ROUTES.CUSTOMER_DASHBOARD)
    return {
      title: UI_CUSTOMER.HEADER_MY_ACTIVITY,
      subtitle: UI_CUSTOMER.HEADER_MY_ACTIVITY_SUB,
    };
  if (pathname === ROUTES.CUSTOMER_CATEGORIES)
    return {
      title: UI_CUSTOMER.DISCOVER_HEADING,
      subtitle: UI_CUSTOMER.DISCOVER_SUB,
    };
  if (pathname === ROUTES.CUSTOMER_SALON_LIST)
    return {
      title: UI_CUSTOMER.NAV_EXPLORE_SERVICES,
      subtitle: UI_CUSTOMER.HEADER_BROWSE_SUB,
    };
  if (pathname === ROUTES.CUSTOMER_PROFILE)
    return {
      title: UI_CUSTOMER.HEADER_PROFILE,
      subtitle: UI_CUSTOMER.HEADER_PROFILE_SUB,
    };
  if (pathname?.startsWith('/booking/'))
    return {
      title: UI_CUSTOMER.HEADER_BOOKING_DETAILS,
      subtitle: UI_CUSTOMER.HEADER_BOOKING_DETAILS_SUB,
    };
  return {
    title: UI_CUSTOMER.HEADER_MY_ACTIVITY,
    subtitle: UI_CUSTOMER.HEADER_MY_ACTIVITY_SUB,
  };
}

env.nodeEnv;

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
  const pathname = usePathname();
  const safePathname = pathname ?? '';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const header = getCustomerHeader(safePathname);
  const [clientUser, setClientUser] = useState<CustomerInitialUser | null>(null);
  const [clientCheckDone, setClientCheckDone] = useState(!requireClientAuthCheck);
  /** When true, session was missing after client check; user stays in flow until they click Sign in or Logout. */
  const [sessionMissing, setSessionMissing] = useState(false);

  useEffect(() => {
    if (env && typeof window !== 'undefined') {
      return;
    }
  }, [initialUser?.id, requireClientAuthCheck]);

  useEffect(() => {
    if (!requireClientAuthCheck) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/session', {
          credentials: 'include',
        });
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
          user_type: (
            profile as {
              user_type?: 'owner' | 'customer' | 'both' | 'admin';
            } | null
          )?.user_type,
          profile_media_id: (profile as { profile_media_id?: string | null } | null)
            ?.profile_media_id,
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

  const user = initialUser?.id ? initialUser : clientUser;
  const loginUrl =
    typeof ROUTES.AUTH_LOGIN === 'function'
      ? ROUTES.AUTH_LOGIN('/customer/dashboard')
      : '/auth/login';

  const isDashboard = safePathname === ROUTES.CUSTOMER_DASHBOARD;
  const isCategories = safePathname === ROUTES.CUSTOMER_CATEGORIES;
  const isSalonList = safePathname === ROUTES.CUSTOMER_SALON_LIST;
  const isProfile = safePathname === ROUTES.CUSTOMER_PROFILE;
  const isBookingDetails = safePathname.startsWith('/booking/');
  const isCustomerMainArea =
    isDashboard || isCategories || isSalonList || isProfile || isBookingDetails;
  const mainSpacing = '';

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

  return (
    <CustomerSessionProvider initialUser={user ?? undefined}>
      <div className="min-h-screen bg-white flex overflow-x-hidden">
        <CustomerSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className={`flex-1 lg:ml-64 w-full ${mainSpacing}`}>
          {isCustomerMainArea ? (
            <div className="mx-auto w-full max-w-[1200px] py-8 px-6 sm:px-8 lg:px-10">
              <div className="flex flex-col gap-6">
                <CustomerHeader title={header.title} subtitle={header.subtitle} />
                {children}
              </div>
            </div>
          ) : (
            <div className="px-4 sm:px-6 lg:px-12 xl:px-16 py-6 lg:py-8">{children}</div>
          )}
        </main>
        <CustomerMobileBottomNav sidebarOpen={sidebarOpen} />
      </div>
    </CustomerSessionProvider>
  );
}
