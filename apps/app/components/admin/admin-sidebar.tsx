'use client';

import { useState, useEffect, Suspense } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getAdminDashboardUrl } from '@cusown/shared';
import { useAdminPrefetch } from '@/components/admin/admin-prefetch-context';
import { useAdminSession } from '@/components/admin/admin-session-context';
import DashboardIcon from '@cusown/shared/icons/dashboard.svg';
import BusinessesIcon from '@cusown/shared/icons/businesses.svg';
import UsersIcon from '@cusown/shared/icons/users.svg';
import BookingsIcon from '@cusown/shared/icons/bookings.svg';
import AuditLogsIcon from '@cusown/shared/icons/audit-logs.svg';
import CronMonitorIcon from '@cusown/shared/icons/cron-monitor.svg';
import AuthManagementIcon from '@cusown/shared/icons/auth-management.svg';
import StorageIcon from '@cusown/shared/icons/storage.svg';
import SuccessMetricsIcon from '@cusown/shared/icons/success-metrics.svg';
import AnalyticsIcon from '@cusown/shared/icons/analytics.svg';
import ProfileIcon from '@cusown/shared/icons/profile.svg';
import LogoutIcon from '@cusown/shared/icons/logout.svg';
import MenuIcon from '@cusown/shared/icons/menu.svg';
import CloseIcon from '@cusown/shared/icons/close.svg';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

interface NavSection {
  title: string;
  items: NavItem[];
}

const navSections: NavSection[] = [
  {
    title: 'Core Operations',
    items: [
      { name: 'Overview', href: getAdminDashboardUrl(), icon: DashboardIcon },
      { name: 'Businesses', href: getAdminDashboardUrl('businesses'), icon: BusinessesIcon },
      { name: 'Users', href: getAdminDashboardUrl('users'), icon: UsersIcon },
      { name: 'Bookings', href: getAdminDashboardUrl('bookings'), icon: BookingsIcon },
      { name: 'Audit Logs', href: '/admin/audit-logs', icon: AuditLogsIcon },
    ],
  },
  {
    title: 'System',
    items: [
      { name: 'Cron Monitor', href: getAdminDashboardUrl('cron-monitor'), icon: CronMonitorIcon },
      {
        name: 'Auth Management',
        href: getAdminDashboardUrl('auth-management'),
        icon: AuthManagementIcon,
      },
      { name: 'Storage', href: getAdminDashboardUrl('storage'), icon: StorageIcon },
    ],
  },
  {
    title: 'Intelligence',
    items: [
      {
        name: 'Success Metrics',
        href: getAdminDashboardUrl('success-metrics'),
        icon: SuccessMetricsIcon,
      },
      { name: 'Analytics', href: getAdminDashboardUrl('analytics'), icon: AnalyticsIcon },
    ],
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
      {/* Mobile menu button absolute overlay (top left in header) */}
      <div className="lg:hidden block">
        {!sidebarOpen && (
          <button
            onClick={() => setSidebarOpen(true)}
            className="fixed top-2.5 left-4 z-40 p-1.5 rounded-md border border-border-primary bg-background-secondary text-text-primary hover:bg-background-tertiary transition-all"
            aria-label="Open menu"
          >
            <MenuIcon className="w-5 h-5" aria-hidden="true" />
          </button>
        )}
      </div>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/65 backdrop-blur-xs z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar container */}
      <aside
        className={`fixed top-0 left-0 z-50 h-screen w-64 border-r border-border-primary bg-[#111111] transition-transform duration-250 ease-in-out ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0 lg:z-0 lg:flex lg:h-full lg:flex-col lg:shrink-0`}
      >
        <div className="flex h-full flex-col">
          {/* Logo/Header */}
          <div className="flex shrink-0 items-start justify-between border-b border-border-primary px-5 py-6">
            <div>
              <h2 className="text-base font-bold tracking-tight text-[#00E676] font-display">
                Cusown Admin
              </h2>
              <p className="mt-1 text-[10px] uppercase tracking-widest text-[#737373] font-mono">
                Console mode
              </p>
            </div>
            {/* Close button inside sidebar on mobile */}
            <div className="lg:hidden">
              <button
                onClick={() => setSidebarOpen(false)}
                className="p-1.5 rounded-md border border-border-primary bg-background-tertiary text-text-primary hover:bg-background-secondary transition-all"
                aria-label="Close menu"
              >
                <CloseIcon className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
          </div>

          {/* Navigation with Sections */}
          <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-6 scrollbar-hide">
            {navSections.map((section) => (
              <div key={section.title} className="space-y-1.5">
                <p className="px-3 text-[10px] font-semibold uppercase tracking-wider text-[#737373] font-mono">
                  {section.title}
                </p>
                <div className="space-y-1">
                  {section.items.map((item) => {
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
                        className={`flex items-center gap-3 rounded-lg px-3 py-2 text-left transition-all duration-150 border-l-2 ${
                          active
                            ? 'border-[#00E676] bg-[#0F3D2E]/25 text-[#00E676] font-medium'
                            : 'border-transparent text-[#A1A1A1] hover:bg-[#181818] hover:text-[#F5F5F5]'
                        }`}
                      >
                        <span className="flex h-5 w-5 shrink-0 items-center justify-center">
                          <item.icon
                            aria-hidden="true"
                            className={`h-4.5 w-4.5 ${active ? 'text-[#00E676]' : 'text-[#737373]'}`}
                          />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-xs">{item.name}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>

          {/* Profile Section */}
          <div className="shrink-0 border-t border-border-primary p-4 bg-[#0A0A0A]/40">
            <div className="flex items-center justify-between gap-3">
              <Link
                href="/admin/profile"
                prefetch={false}
                className="min-w-0 flex-1 flex items-center gap-3"
                onClick={() => setSidebarOpen(false)}
              >
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#181818] border border-border-primary text-text-primary">
                  <ProfileIcon className="h-4 w-4 text-[#A1A1A1]" aria-hidden="true" />
                </div>
                <div className="min-w-0 flex-1 flex flex-col">
                  <span className="truncate text-xs font-semibold text-[#F5F5F5]">
                    {userName || 'User'}
                  </span>
                  <span className="truncate text-[10px] text-[#737373] font-mono">
                    {userEmail || ''}
                  </span>
                </div>
              </Link>
              <a
                href="/api/auth/signout"
                className="shrink-0 rounded-lg p-2 text-red-500 transition-colors hover:bg-[#181818] hover:text-[#FF5C5C]"
                title="Sign Out"
              >
                <LogoutIcon className="h-[18px] w-[18px]" aria-hidden="true" />
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
