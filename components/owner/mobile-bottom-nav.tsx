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

  const tabParam = searchParams?.get('tab') ?? null;

  let activeTab: string | null = null;

  if (tabParam) {
    activeTab = tabParam;
  } else if (pathname?.startsWith('/owner/services')) {
    activeTab = 'services';
  } else if (pathname?.startsWith('/owner/businesses')) {
    activeTab = 'businesses';
  } else if (pathname?.startsWith('/owner/analytics')) {
    activeTab = 'analytics';
  } else if (pathname?.startsWith('/owner/dashboard')) {
    activeTab = 'dashboard';
  } else if (pathname?.startsWith('/owner/profile')) {
    activeTab = 'profile';
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
    const basePath = href.split('?')[0];

    return (
      pathname === basePath ||
      pathname?.startsWith(basePath + '/') ||
      (href.includes('?tab=') && activeTab === href.split('tab=')[1])
    );
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
                active ? 'text-gray-900' : 'text-gray-500'
              }`}
            >
              <span className="flex items-center justify-center">
                <item.icon
                  aria-hidden="true"
                  className={`h-5 w-5 ${active ? 'text-gray-900' : 'text-gray-500'}`}
                />
              </span>
              <span
                className={`text-xs font-medium leading-none ${
                  active ? 'text-gray-900' : 'text-gray-500'
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
