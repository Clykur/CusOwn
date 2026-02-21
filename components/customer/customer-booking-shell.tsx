'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import CustomerSidebar from '@/components/customer/customer-sidebar';
import CustomerMobileBottomNav from '@/components/customer/mobile-bottom-nav';
import {
  CustomerSessionProvider,
  type CustomerInitialUser,
} from '@/components/customer/customer-session-context';
import { ROUTES } from '@/lib/utils/navigation';
import { UI_CUSTOMER } from '@/config/constants';

type CustomerBookingShellProps = {
  children: React.ReactNode;
  initialUser: CustomerInitialUser;
};

/**
 * Wraps public booking page (/b/[bookingLink]) for logged-in customers:
 * customer sidebar, breadcrumb back to Explore Services, same layout as customer area.
 */
export default function CustomerBookingShell({ children, initialUser }: CustomerBookingShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pathname = usePathname();
  const isBookingStatus = pathname?.startsWith('/booking/');
  const breadcrumbHref = isBookingStatus ? ROUTES.CUSTOMER_DASHBOARD : ROUTES.CUSTOMER_SALON_LIST;
  const breadcrumbLabel = isBookingStatus
    ? UI_CUSTOMER.NAV_MY_ACTIVITY
    : UI_CUSTOMER.BREADCRUMB_BACK_EXPLORE;

  return (
    <CustomerSessionProvider initialUser={initialUser ?? undefined}>
      <div className="min-h-screen bg-white flex overflow-x-hidden">
        <CustomerSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
        <main className="flex-1 lg:ml-64 w-full">
          <div className="mx-auto w-full max-w-[1200px] py-8 px-6 sm:px-8 lg:px-10">
            <div className="flex flex-col gap-8">
              <nav aria-label="Breadcrumb">
                <Link
                  href={breadcrumbHref}
                  className="text-sm text-slate-600 hover:text-slate-900 flex items-center gap-1"
                >
                  <span aria-hidden>←</span>
                  {breadcrumbLabel}
                </Link>
              </nav>
              {children}
            </div>
          </div>
        </main>
        <CustomerMobileBottomNav sidebarOpen={sidebarOpen} />
      </div>
    </CustomerSessionProvider>
  );
}
