'use client';

import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/lib/utils/navigation';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  activeIcon: React.ReactNode;
}

export default function MobileBottomNav({ sidebarOpen }: { sidebarOpen?: boolean }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  if (sidebarOpen) return null;

  // Extract booking link from pathname if it's a specific business dashboard (exclude '/owner/dashboard')
  const bookingLinkMatch = pathname?.match(/^\/owner\/(?!dashboard$)([^\/]+)$/);
  const bookingLink = bookingLinkMatch ? bookingLinkMatch[1] : undefined;
  const tabParam = searchParams?.get('tab') ?? null;

  const isSetup = pathname === ROUTES.SETUP || pathname === ROUTES.OWNER_SETUP;
  const isProfile =
    pathname === ROUTES.OWNER_PROFILE ||
    pathname === '/owner/profile' ||
    pathname?.startsWith('/owner/profile');

  // Determine a single active tab value. Priority: explicit `tab` query -> businesses route -> business instance -> dashboard -> others
  let activeTab: string | null = null;
  if (tabParam) {
    activeTab = tabParam;
  } else if (pathname === '/owner/businesses' || pathname?.startsWith('/owner/businesses')) {
    activeTab = 'businesses';
  } else if (pathname === ROUTES.OWNER_DASHBOARD_BASE || pathname?.startsWith('/owner/dashboard')) {
    activeTab = 'dashboard';
  } else if (isSetup) {
    activeTab = 'create';
  } else if (isProfile) {
    activeTab = 'profile';
  }

  const navigation: NavItem[] = [
    {
      name: 'Dashboard',
      href: `${ROUTES.OWNER_DASHBOARD_BASE}?tab=dashboard`,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
      activeIcon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      ),
    },
    {
      name: 'Businesses',
      href: '/owner/businesses',
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
          />
        </svg>
      ),
      activeIcon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
    {
      name: 'Profile',
      href: ROUTES.OWNER_PROFILE,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
          />
        </svg>
      ),
      activeIcon: (
        <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
          <path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      ),
    },
  ];

  const isActive = (href: string) => {
    if (href === ROUTES.OWNER_SETUP || href === ROUTES.SETUP) return activeTab === 'create';
    if (href === ROUTES.OWNER_PROFILE || href === '/owner/profile' || href === pathname)
      return (
        activeTab === 'profile' ||
        pathname === '/owner/profile' ||
        pathname?.startsWith('/owner/profile')
      );

    // hrefs for dashboard tabs use ?tab=...
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
              className={`flex flex-col items-center justify-center flex-1 min-w-0 px-2 py-2 transition-colors relative ${
                active ? 'text-black' : 'text-gray-500'
              }`}
            >
              <span className="mb-1">{active ? item.activeIcon : item.icon}</span>
              <span className={`text-xs font-medium ${active ? 'text-black' : 'text-gray-500'}`}>
                {item.name}
              </span>
              {active && (
                <span className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-1 h-1 bg-black rounded-full"></span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
