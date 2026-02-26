'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/lib/utils/navigation';
import { UI_CUSTOMER } from '@/config/constants';
import ActivityIcon from '@/src/icons/activity.svg';
import ExploreIcon from '@/src/icons/explore.svg';
import ProfileIcon from '@/src/icons/profile.svg';

export default function CustomerMobileBottomNav({ sidebarOpen }: { sidebarOpen?: boolean }) {
  const pathname = usePathname();
  if (sidebarOpen) return null;
  const navItems: {
    name: string;
    href: string;
    icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  }[] = [
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
    {
      name: UI_CUSTOMER.NAV_PROFILE,
      href: ROUTES.CUSTOMER_PROFILE,
      icon: ProfileIcon,
    },
  ];

  const isActive = (href: string) => {
    // My Activity: customer dashboard + booking status pages
    if (href === ROUTES.CUSTOMER_DASHBOARD) {
      return pathname === ROUTES.CUSTOMER_DASHBOARD || pathname?.startsWith('/booking/');
    }
    // Explore Services: categories, salon lists, salon detail, business pages, booking flow
    if (href === ROUTES.CUSTOMER_CATEGORIES) {
      return (
        pathname === ROUTES.CUSTOMER_CATEGORIES ||
        pathname?.startsWith('/customer/categories/') ||
        pathname === ROUTES.CUSTOMER_SALON_LIST ||
        pathname?.startsWith('/salon/') ||
        pathname?.startsWith('/b/') ||
        pathname?.startsWith('/book/')
      );
    }
    // Profile: exact match
    if (href === ROUTES.CUSTOMER_PROFILE) return pathname === ROUTES.CUSTOMER_PROFILE;
    return pathname === href;
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-200 z-50 safe-area-bottom">
      <div className="grid grid-cols-3 h-16">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
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
