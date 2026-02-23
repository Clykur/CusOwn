'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

import { getAdminDashboardUrl } from '@/lib/utils/navigation';
import { UI_CONTEXT } from '@/config/constants';
import { useAdminPrefetch } from '@/components/admin/admin-prefetch-context';
import { useAdminSession } from '@/components/admin/admin-session-context';

const navigation: NavItem[] = [
  {
    name: 'Overview',
    href: getAdminDashboardUrl(),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
        />
      </svg>
    ),
  },
  {
    name: 'Businesses',
    href: getAdminDashboardUrl('businesses'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
        />
      </svg>
    ),
  },
  {
    name: 'Users',
    href: getAdminDashboardUrl('users'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"
        />
      </svg>
    ),
  },
  {
    name: 'Bookings',
    href: getAdminDashboardUrl('bookings'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    ),
  },
  {
    name: 'Audit Logs',
    href: getAdminDashboardUrl('audit'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
    ),
  },
  {
    name: 'Cron Monitor',
    href: getAdminDashboardUrl('cron-monitor'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
    ),
  },
  {
    name: 'Auth Management',
    href: getAdminDashboardUrl('auth-management'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l11.964-11.964A6 6 0 1121 9z"
        />
      </svg>
    ),
  },
  {
    name: 'Storage',
    href: getAdminDashboardUrl('storage'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 19a2 2 0 01-2 2H3a2 2 0 01-2-2V5a2 2 0 012-2h2a2 2 0 012 2v2h2a2 2 0 012 2zm0 0h2a2 2 0 002-2v-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2m-6-6a2 2 0 00-2 2v2a2 2 0 002 2h2a2 2 0 002-2v-2a2 2 0 00-2-2h-2z"
        />
      </svg>
    ),
  },
  {
    name: 'Success Metrics',
    href: getAdminDashboardUrl('success-metrics'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
        />
      </svg>
    ),
  },
  {
    name: 'Analytics',
    href: getAdminDashboardUrl('analytics'),
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M16 8v8m-4-4v4m-4-4v4M4 4v16"
        />
      </svg>
    ),
  },
];

const ADMIN_TAB_EVENT = 'admin-tab-change';

function getTabFromSearch(search: string): string {
  const tab = new URLSearchParams(search).get('tab');
  return tab || 'overview';
}

function AdminSidebarContent() {
  const pathname = usePathname();
  const router = useRouter();
  const { session } = useAdminSession();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dashboardTab, setDashboardTab] = useState('overview');

  const userEmail = session?.user?.email ?? '';
  const userName =
    (session?.profile as { full_name?: string } | null)?.full_name ||
    session?.user?.email?.split('@')[0] ||
    'User';

  useEffect(() => {
    if (pathname !== '/admin/dashboard') return;
    const readFromWindow = () =>
      setDashboardTab(
        typeof window !== 'undefined' ? getTabFromSearch(window.location.search) : 'overview'
      );
    readFromWindow();
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<{ tab?: string }>).detail;
      if (detail?.tab) setDashboardTab(detail.tab);
    };
    window.addEventListener(ADMIN_TAB_EVENT, handler);
    window.addEventListener('popstate', readFromWindow);
    return () => {
      window.removeEventListener(ADMIN_TAB_EVENT, handler);
      window.removeEventListener('popstate', readFromWindow);
    };
  }, [pathname]);

  const { prefetchTab } = useAdminPrefetch();
  const getTabFromHref = (href: string) =>
    href.includes('?tab=') ? (href.split('tab=')[1]?.split('&')[0] ?? null) : null;

  const isActive = (href: string) => {
    if (pathname.startsWith('/admin/bookings') && href.includes('tab=bookings')) return true;
    if (pathname.startsWith('/admin/users') && href.includes('tab=users')) return true;
    if (!href.startsWith('/admin/dashboard')) return pathname === href;
    if (pathname !== '/admin/dashboard') return false;
    const hrefTab = href.includes('?tab=') ? href.split('tab=')[1]?.split('&')[0] : 'overview';
    return dashboardTab === hrefTab;
  };

  const onTabLinkClick = (href: string) => {
    const tab = getTabFromHref(href);
    if (tab && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(ADMIN_TAB_EVENT, { detail: { tab } }));
    }
  };

  return (
    <>
      {/* Mobile menu button (non-floating) - shown only when sidebar is closed */}
      <div className="lg:hidden block">
        {!sidebarOpen && (
          <div className="px-4 pt-4">
            <button
              onClick={() => setSidebarOpen(true)}
              className="p-2.5 bg-white border-2 border-gray-200 rounded-xl shadow-sm hover:shadow transition-all"
              aria-label="Open menu"
            >
              <svg
                className="w-6 h-6 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 6h16M4 12h16M4 18h16"
                />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-slate-50 border-r border-slate-200 transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          {/* Logo/Header - section grouping */}
          <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-5 py-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">
                {UI_CONTEXT.ADMIN_CONSOLE}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">{UI_CONTEXT.YOU_ARE_IN_ADMIN_MODE}</p>
            </div>
            {/* Close button shown inside sidebar on mobile to avoid overlap */}
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

          {/* Navigation - increased spacing, subtle active state */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
            {navigation.map((item) => {
              const active = isActive(item.href);
              const tab = getTabFromHref(item.href);
              const isDashboardTab = item.href.startsWith('/admin/dashboard');
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  prefetch={false}
                  onClick={(e) => {
                    setSidebarOpen(false);
                    if (isDashboardTab) {
                      e.preventDefault();
                      router.replace(item.href);
                    }
                    onTabLinkClick(item.href);
                  }}
                  onMouseEnter={() => {
                    if (tab) prefetchTab(tab);
                  }}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 ${
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

          {/* Profile Section */}
          <div className="shrink-0 border-t border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/admin/profile"
                prefetch={false}
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
                href="/api/auth/signout"
                className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-900"
                title="Sign Out"
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

export default function AdminSidebar() {
  return (
    <Suspense fallback={<div className="w-64" />}>
      <AdminSidebarContent />
    </Suspense>
  );
}
