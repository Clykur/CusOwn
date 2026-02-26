'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/lib/utils/navigation';
import DashboardIcon from '@/src/icons/dashboard.svg';
import BusinessesIcon from '@/src/icons/businesses.svg';
import AnalyticsIcon from '@/src/icons/analytics.svg';
import ProfileIcon from '@/src/icons/profile.svg';

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

export default function MobileBottomNav({ sidebarOpen }: { sidebarOpen?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (sidebarOpen) return null;

  // Extract booking link from pathname if it's a specific business dashboard (exclude '/owner/dashboard')
  const tabParam = searchParams?.get('tab') ?? null;

  const isSetup = pathname === ROUTES.SETUP || pathname === ROUTES.OWNER_SETUP;
  const isProfile =
    pathname === ROUTES.OWNER_PROFILE ||
    pathname === '/owner/profile' ||
    pathname?.startsWith('/owner/profile');

  const isAnalytics = pathname === '/owner/analytics' || pathname?.startsWith('/owner/analytics/');

  // Determine a single active tab value. Priority: explicit `tab` query -> businesses route -> analytics -> business instance -> dashboard -> others
  let activeTab: string | null = null;
  if (tabParam) {
    activeTab = tabParam;
  } else if (pathname === '/owner/businesses' || pathname?.startsWith('/owner/businesses')) {
    activeTab = 'businesses';
  } else if (isAnalytics) {
    activeTab = 'analytics';
  } else if (pathname === ROUTES.OWNER_DASHBOARD_BASE || pathname?.startsWith('/owner/dashboard')) {
    activeTab = 'dashboard';
  } else if (isSetup) {
    activeTab = 'create';
  } else if (isProfile) {
    activeTab = 'profile';
  } else if (pathname?.startsWith('/owner/')) {
    // Individual business pages (/owner/[bookingLink]) fall under Businesses
    activeTab = 'businesses';
  }

  const navigation: NavItem[] = [
    {
      name: 'Dashboard',
      href: `${ROUTES.OWNER_DASHBOARD_BASE}?tab=dashboard`,
      icon: DashboardIcon,
    },
    {
      name: 'Businesses',
      href: '/owner/businesses',
      icon: BusinessesIcon,
    },
    {
      name: 'Analytics',
      href: '/owner/analytics',
      icon: AnalyticsIcon,
    },
    {
      name: 'Profile',
      href: ROUTES.OWNER_PROFILE,
      icon: ProfileIcon,
    },
  ];

  const isActive = (href: string) => {
    if (href === ROUTES.OWNER_SETUP || href === ROUTES.SETUP) return activeTab === 'create';
    if (href === ROUTES.OWNER_PROFILE || href === '/owner/profile') return activeTab === 'profile';

    // Analytics exact match
    if (href === '/owner/analytics') return activeTab === 'analytics';

    // Businesses: exact match or individual business pages
    if (href === '/owner/businesses') return activeTab === 'businesses';

    // Dashboard tabs use ?tab=...
    const tabMatch = href.match(/\?tab=(.+)$/);
    if (tabMatch) {
      return activeTab === tabMatch[1];
    }

    return pathname === href;
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      <div className="flex items-center justify-around h-16 px-2">
        {navigation.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-1 min-w-0 flex-col items-center justify-center gap-1 px-2 py-2 transition-colors ${
                active ? 'text-indigo-600' : 'text-gray-500'
              }`}
            >
              <span className="flex items-center justify-center">
                <item.icon
                  aria-hidden="true"
                  className={`h-5 w-5 ${active ? 'text-indigo-600' : 'text-gray-500'}`}
                />
              </span>
              <span
                className={`text-xs font-medium leading-none ${
                  active ? 'text-indigo-600' : 'text-gray-500'
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
