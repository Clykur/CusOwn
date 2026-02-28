'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAdminDashboardUrl } from '@/lib/utils/navigation';
import { UI_CONTEXT } from '@/config/constants';
import { useAdminPrefetch } from '@/components/admin/admin-prefetch-context';
import { useAdminSession } from '@/components/admin/admin-session-context';
import DashboardIcon from '@/src/icons/dashboard.svg';
import BusinessesIcon from '@/src/icons/businesses.svg';
import UsersIcon from '@/src/icons/users.svg';
import BookingsIcon from '@/src/icons/bookings.svg';
import AuditLogsIcon from '@/src/icons/audit-logs.svg';
import CronMonitorIcon from '@/src/icons/cron-monitor.svg';
import AuthManagementIcon from '@/src/icons/auth-management.svg';
import StorageIcon from '@/src/icons/storage.svg';
import SuccessMetricsIcon from '@/src/icons/success-metrics.svg';
import AnalyticsIcon from '@/src/icons/analytics.svg';
import ProfileIcon from '@/src/icons/profile.svg';
import LogoutIcon from '@/src/icons/logout.svg';
import MenuIcon from '@/src/icons/menu.svg';
import CloseIcon from '@/src/icons/close.svg';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const navigation: NavItem[] = [
  { name: 'Overview', href: getAdminDashboardUrl(), icon: DashboardIcon },
  {
    name: 'Businesses',
    href: getAdminDashboardUrl('businesses'),
    icon: BusinessesIcon,
  },
  { name: 'Users', href: getAdminDashboardUrl('users'), icon: UsersIcon },
  {
    name: 'Bookings',
    href: getAdminDashboardUrl('bookings'),
    icon: BookingsIcon,
  },
  {
    name: 'Audit Logs',
    href: getAdminDashboardUrl('audit'),
    icon: AuditLogsIcon,
  },
  {
    name: 'Cron Monitor',
    href: getAdminDashboardUrl('cron-monitor'),
    icon: CronMonitorIcon,
  },
  {
    name: 'Auth Management',
    href: getAdminDashboardUrl('auth-management'),
    icon: AuthManagementIcon,
  },
  { name: 'Storage', href: getAdminDashboardUrl('storage'), icon: StorageIcon },
  {
    name: 'Success Metrics',
    href: getAdminDashboardUrl('success-metrics'),
    icon: SuccessMetricsIcon,
  },
  {
    name: 'Analytics',
    href: getAdminDashboardUrl('analytics'),
    icon: AnalyticsIcon,
  },
];

const ADMIN_TAB_EVENT = 'admin-tab-change';

function getTabFromSearch(search: string): string {
  const tab = new URLSearchParams(search).get('tab');
  return tab || 'overview';
}

function AdminSidebarContent() {
  const pathname = usePathname();
  const safePathname = pathname ?? '';
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
    if (safePathname !== '/admin/dashboard') return;
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
  }, [safePathname]);

  const { prefetchTab } = useAdminPrefetch();
  const getTabFromHref = (href: string) =>
    href.includes('?tab=') ? (href.split('tab=')[1]?.split('&')[0] ?? null) : null;

  const isActive = (href: string) => {
    if (safePathname.startsWith('/admin/bookings') && href.includes('tab=bookings')) return true;
    if (safePathname.startsWith('/admin/users') && href.includes('tab=users')) return true;
    if (!href.startsWith('/admin/dashboard')) return safePathname === href;
    if (safePathname !== '/admin/dashboard') return false;
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
              <MenuIcon className="w-6 h-6 text-gray-700" aria-hidden="true" />
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
                <CloseIcon className="w-5 h-5 text-gray-700" aria-hidden="true" />
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
                  <ProfileIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
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
                <LogoutIcon className="h-5 w-5 text-gray-500" aria-hidden="true" />
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
