'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/lib/utils/navigation';
import { UI_CONTEXT, UI_CUSTOMER } from '@/config/constants';
import { useCustomerSession } from '@/components/customer/customer-session-context';
import ActivityIcon from '@/src/icons/activity.svg';
import ExploreIcon from '@/src/icons/explore.svg';
import ProfileIcon from '@/src/icons/profile.svg';
import LogoutIcon from '@/src/icons/logout.svg';
import CloseIcon from '@/src/icons/close.svg';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const navigation: NavItem[] = [
  {
    name: UI_CUSTOMER.NAV_MY_ACTIVITY,
    href: ROUTES.CUSTOMER_DASHBOARD,
    icon: ActivityIcon,
  },
  {
    name: UI_CUSTOMER.NAV_EXPLORE_SERVICES,
    href: ROUTES.CUSTOMER_CATEGORIES,
    icon: ExploreIcon,
  },
];

export default function CustomerSidebar({
  sidebarOpen: propSidebarOpen,
  setSidebarOpen: propSetSidebarOpen,
}: {
  sidebarOpen?: boolean;
  setSidebarOpen?: (v: boolean) => void;
} = {}) {
  const pathname = usePathname();

  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);
  const sidebarOpen = propSidebarOpen ?? internalSidebarOpen;
  const setSidebarOpen = propSetSidebarOpen ?? setInternalSidebarOpen;

  const { initialUser } = useCustomerSession();

  const userEmail = initialUser?.email ?? '';
  const userName = initialUser?.full_name || initialUser?.email?.split('@')[0] || 'User';

  const isActive = (href: string) => {
    if (pathname === href) return true;
    // My Activity: customer dashboard + booking status pages
    if (href === ROUTES.CUSTOMER_DASHBOARD) {
      return pathname === ROUTES.CUSTOMER_DASHBOARD || pathname?.startsWith('/booking/');
    }
    // Explore Services: categories, salon lists, salon detail, business pages, booking flow
    if (href === ROUTES.CUSTOMER_CATEGORIES)
      return (
        pathname === ROUTES.CUSTOMER_CATEGORIES ||
        pathname?.startsWith('/customer/categories/') ||
        pathname === ROUTES.CUSTOMER_SALON_LIST ||
        pathname?.startsWith('/salon/') ||
        pathname?.startsWith('/b/') ||
        pathname?.startsWith('/book/')
      );
    if (href === ROUTES.CUSTOMER_PROFILE) return pathname === ROUTES.CUSTOMER_PROFILE;
    return false;
  };

  return (
    <>
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-slate-50 border-r border-slate-200 transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-5 py-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">CusOwn</h2>
              <p className="mt-0.5 text-xs text-slate-500">{UI_CONTEXT.VIEWING_AS_CUSTOMER}</p>
            </div>
            <div className="lg:hidden">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-2.5 ml-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:shadow transition-all"
                aria-label="Close menu"
              >
                <CloseIcon className="w-5 h-5 text-gray-700" aria-hidden="true" />
              </button>
            </div>
          </div>

          <nav className="flex-1 space-y-2 overflow-y-auto px-3 py-6">
            {navigation.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={(e) => {
                    if (item.href !== pathname) setSidebarOpen(false);
                    else e.preventDefault();
                  }}
                  className={`flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors duration-150 ${
                    active
                      ? 'border-l-2 border-indigo-600 bg-indigo-50 font-medium text-indigo-600'
                      : 'border-l-2 border-transparent text-slate-600 hover:bg-slate-200/40 hover:text-slate-900'
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                    <item.icon
                      aria-hidden="true"
                      className={`h-5 w-5 ${active ? 'text-indigo-600' : 'text-gray-500'}`}
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          <div className="shrink-0 border-t border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <Link
                href={ROUTES.CUSTOMER_PROFILE}
                className="min-w-0 flex-1 flex items-center gap-3"
                onClick={() => setSidebarOpen(false)}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                  <ProfileIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col">
                  <span className="truncate text-sm font-medium text-slate-900">
                    {userName || 'User'}
                  </span>
                  <span className="truncate text-xs text-slate-500">{userEmail || ''}</span>
                </div>
              </Link>
              <button
                onClick={() => {
                  window.location.href = '/api/auth/signout?redirect_to=%2F';
                }}
                className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-900"
                title="Sign out"
              >
                <LogoutIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
