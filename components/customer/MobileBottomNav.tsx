'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/lib/utils/navigation';

export default function CustomerMobileBottomNav() {
  const pathname = usePathname();

  const navItems = [
    {
      name: 'Bookings',
      href: ROUTES.CUSTOMER_DASHBOARD,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      ),
    },
    {
      name: 'Book',
      href: ROUTES.CATEGORIES,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
    {
      name: 'Salons',
      href: ROUTES.SALON_LIST,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      ),
    },
  ];

  const isActive = (href: string) => {
    if (href === ROUTES.CUSTOMER_DASHBOARD) {
      return pathname === ROUTES.CUSTOMER_DASHBOARD || pathname?.startsWith('/booking/');
    }
    if (href === ROUTES.CATEGORIES) {
      return pathname === ROUTES.CATEGORIES;
    }
    if (href === ROUTES.SALON_LIST) {
      return pathname === ROUTES.SALON_LIST || pathname?.startsWith('/salon/');
    }
    return pathname === href;
  };

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 safe-area-bottom">
      <div className="grid grid-cols-3 h-16">
        {navItems.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex flex-col items-center justify-center gap-1 transition-colors ${
                active
                  ? 'text-black'
                  : 'text-gray-500'
              }`}
            >
              <div className={active ? 'text-black' : 'text-gray-500'}>
                {item.icon}
              </div>
              <span className={`text-xs font-medium ${active ? 'text-black' : 'text-gray-500'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
