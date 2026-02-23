'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ROUTES } from '@/lib/utils/navigation';
import { UI_CUSTOMER } from '@/config/constants';

export default function CustomerMobileBottomNav({ sidebarOpen }: { sidebarOpen?: boolean }) {
  const pathname = usePathname();
  if (sidebarOpen) return null;
  const navItems = [
    {
      name: UI_CUSTOMER.NAV_MY_ACTIVITY,
      href: ROUTES.CUSTOMER_DASHBOARD,
      icon: (
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
          />
        </svg>
      ),
    },
    {
      name: UI_CUSTOMER.NAV_PROFILE,
      href: ROUTES.CUSTOMER_PROFILE,
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
    },
  ];

  const isActive = (href: string) => {
    if (href === ROUTES.CUSTOMER_DASHBOARD) {
      return (
        pathname === ROUTES.CUSTOMER_DASHBOARD ||
        pathname?.startsWith('/booking/') ||
        pathname?.startsWith('/b/')
      );
    }
    if (href === ROUTES.CUSTOMER_CATEGORIES)
      return pathname === ROUTES.CUSTOMER_CATEGORIES || pathname === ROUTES.CUSTOMER_SALON_LIST;
    if (href === ROUTES.CUSTOMER_PROFILE) return pathname === ROUTES.CUSTOMER_PROFILE;
    if (href === ROUTES.CUSTOMER_SALON_LIST)
      return pathname === ROUTES.CUSTOMER_SALON_LIST || pathname?.startsWith('/salon/');
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
                active ? 'text-slate-900' : 'text-slate-500'
              }`}
            >
              <div className={active ? 'text-slate-900' : 'text-slate-500'}>{item.icon}</div>
              <span
                className={`text-xs font-medium ${active ? 'text-slate-900' : 'text-slate-500'}`}
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
