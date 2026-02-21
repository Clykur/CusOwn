'use client';

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/lib/utils/navigation';
import { UI_CONTEXT, UI_CUSTOMER } from '@/config/constants';
import { useCustomerSession } from '@/components/customer/customer-session-context';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

const navigation: NavItem[] = [
  {
    name: UI_CUSTOMER.NAV_MY_ACTIVITY,
    href: ROUTES.CUSTOMER_DASHBOARD,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
    ),
  },
  {
    name: UI_CUSTOMER.NAV_EXPLORE_SERVICES,
    href: ROUTES.CUSTOMER_CATEGORIES,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
        />
      </svg>
    ),
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
    if (href === ROUTES.CUSTOMER_DASHBOARD) {
      return pathname === ROUTES.CUSTOMER_DASHBOARD || pathname?.startsWith('/booking/');
    }
    if (href === ROUTES.CUSTOMER_CATEGORIES)
      return (
        pathname === ROUTES.CUSTOMER_CATEGORIES ||
        pathname === ROUTES.CUSTOMER_SALON_LIST ||
        pathname?.startsWith('/b/')
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
                <svg
                  className="w-5 h-5 text-gray-700"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
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
                      ? 'border-l-2 border-slate-900 bg-slate-200/60 font-medium text-slate-900'
                      : 'border-l-2 border-transparent text-slate-600 hover:bg-slate-200/40 hover:text-slate-900'
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
                    {item.icon}
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
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1 flex flex-col">
                  <span className="truncate text-sm font-medium text-slate-900">
                    {userName || 'User'}
                  </span>
                  <span className="truncate text-xs text-slate-500">{userEmail || ''}</span>
                </div>
              </Link>
              <a
                href={`/api/auth/signout?redirect_to=${encodeURIComponent(ROUTES.SELECT_ROLE('owner'))}`}
                className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-900"
                title="Sign out"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
                  />
                </svg>
              </a>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
