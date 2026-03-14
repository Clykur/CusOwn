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
import { useMounted } from '@/lib/hooks/use-mounted';
import { prefetchCustomerDashboard } from '@/lib/prefetch/customer-dashboard';

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

const AuthLoadingContent = () => (
  <div className="flex-1 flex items-center justify-center py-24">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-slate-200 border-t-slate-500 rounded-full animate-spin" />
      <p className="text-gray-500 text-sm">Loading...</p>
    </div>
  </div>
);

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
  const mounted = useMounted();
  const pathname = usePathname();
  const router = useRouter();
  const safePathname = pathname ?? '';
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const header = getCustomerHeader(safePathname);
  const [clientUser, setClientUser] = useState<CustomerInitialUser | null>(null);
  const [clientCheckDone, setClientCheckDone] = useState(!requireClientAuthCheck);
  const [sessionMissing, setSessionMissing] = useState(false);

  useEffect(() => {
    if (!mounted || !requireClientAuthCheck) return;
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
  }, [mounted, requireClientAuthCheck]);

  // Prefetch dashboard data after successful auth
  useEffect(() => {
    const hasUser = !!(initialUser?.id || clientUser?.id);
    if (!mounted || !hasUser) return;

    // Prefetch route for instant navigation
    router.prefetch(ROUTES.CUSTOMER_DASHBOARD);

    // Prefetch bookings data and store in Zustand
    prefetchCustomerDashboard();
  }, [mounted, initialUser?.id, clientUser?.id, router]);

  const user = initialUser?.id ? initialUser : clientUser;
  const loginUrl =
    typeof ROUTES.AUTH_LOGIN === 'function'
      ? ROUTES.AUTH_LOGIN('/customer/dashboard')
      : '/auth/login';

  const isDashboard = safePathname === ROUTES.CUSTOMER_DASHBOARD;
  const isCategories = safePathname === ROUTES.CUSTOMER_CATEGORIES;
  const isSalonList = safePathname === ROUTES.CUSTOMER_SALON_LIST;
  const isProfile = safePathname === ROUTES.CUSTOMER_PROFILE;
  const mainSpacing = '';

  // Only show CustomerHeader for main dashboard pages, not for detail/booking pages
  const showHeader = isDashboard || isCategories || isSalonList || isProfile;

  // Determine content to render
  let content: React.ReactNode;

  if (requireClientAuthCheck && (!mounted || !clientCheckDone)) {
    content = <AuthLoadingContent />;
  } else if (requireClientAuthCheck && sessionMissing) {
    content = (
      <div className="flex-1 flex items-center justify-center py-24">
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
  } else {
    content = (
      <>
        {showHeader && <CustomerHeader title={header.title} subtitle={header.subtitle} />}
        {children}
      </>
    );
  }

  return (
    <CustomerSessionProvider initialUser={user ?? undefined}>
      <div className="min-h-screen bg-white flex overflow-x-hidden">
        <CustomerSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className={`flex-1 lg:ml-60 w-full ${mainSpacing}`}>
          <div className="mx-auto w-full max-w-[1200px] py-8 px-4 sm:px-6 lg:px-6">
            <div className="flex flex-col gap-6">{content}</div>
          </div>
        </main>
        <CustomerMobileBottomNav sidebarOpen={sidebarOpen} />
      </div>
    </CustomerSessionProvider>
  );
}
