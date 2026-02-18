'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut, getUserProfile } from '@/lib/supabase/auth';
import { ROUTES } from '@/lib/utils/navigation';
import { UI_CONTEXT } from '@/config/constants';
import { supabaseAuth } from '@/lib/supabase/auth';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
}

const navigation: NavItem[] = [
  {
    name: 'My Bookings',
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
    name: 'Book Appointment',
    href: ROUTES.CATEGORIES,
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
    ),
  },
  {
    name: 'Browse Salons',
    href: ROUTES.SALON_LIST,
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
];

export default function CustomerSidebar({
  sidebarOpen: propSidebarOpen,
  setSidebarOpen: propSetSidebarOpen,
}: {
  sidebarOpen?: boolean;
  setSidebarOpen?: (v: boolean) => void;
} = {}) {
  const router = useRouter();
  const pathname = usePathname();

  // Support lifted state from parent (CustomerLayout) or fallback to internal state
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);
  const sidebarOpen = propSidebarOpen ?? internalSidebarOpen;
  const setSidebarOpen = propSetSidebarOpen ?? setInternalSidebarOpen;

  const [navigating, setNavigating] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  const handleLogout = async () => {
    try {
      await signOut();
      router.push('/');
    } catch (err) {
      console.error('Logout failed:', err);
      alert('Failed to logout. Please try again.');
    }
  };

  useEffect(() => {
    setNavigating(null);
  }, [pathname]);

  useEffect(() => {
    const loadUserInfo = async () => {
      if (!supabaseAuth) return;

      try {
        const {
          data: { session },
        } = await supabaseAuth.auth.getSession();
        if (session?.user) {
          setUserEmail(session.user.email || '');

          // Get user profile for full name
          try {
            const profile = await getUserProfile(session.user.id);
            if (profile && (profile as any).full_name) {
              setUserName((profile as any).full_name);
            } else {
              setUserName(session.user.email?.split('@')[0] || 'User');
            }
          } catch {
            setUserName(session.user.email?.split('@')[0] || 'User');
          }
        }
      } catch (error) {
        console.error('[CustomerSidebar] Error loading user info:', error);
      }
    };

    loadUserInfo();
  }, []);

  const isActive = (href: string) => {
    // Check exact matches first
    if (pathname === href) {
      return true;
    }

    // Dashboard: active on dashboard or booking status pages
    if (href === ROUTES.CUSTOMER_DASHBOARD) {
      return pathname === ROUTES.CUSTOMER_DASHBOARD || pathname?.startsWith('/booking/');
    }

    // Categories: active only on /categories (not on /categories/salon or /salon/)
    if (href === ROUTES.CATEGORIES) {
      return pathname === ROUTES.CATEGORIES;
    }

    // Salon List: active on /categories/salon or /salon/[id]
    if (href === ROUTES.SALON_LIST) {
      return pathname === ROUTES.SALON_LIST || pathname?.startsWith('/salon/');
    }

    return false;
  };

  return (
    <>
      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`
    fixed top-0 left-0 z-50 h-full w-64 bg-white
    transition-transform duration-300
    ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
    lg:static lg:translate-x-0
  `}
      >
        <div className="h-full flex flex-col">
          {/* Logo/Header */}
          <div className="p-6 border-b border-gray-200 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Customer</h2>
              <p className="text-sm text-gray-500 mt-1">{UI_CONTEXT.VIEWING_AS_CUSTOMER}</p>
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

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {navigation.map((item) => {
              const active = isActive(item.href);
              const isNavigating = navigating === item.href;
              return (
                <Link
                  key={item.name}
                  href={item.href}
                  onClick={(e) => {
                    if (item.href !== pathname) {
                      setNavigating(item.href);
                      setSidebarOpen(false);
                    } else {
                      e.preventDefault();
                    }
                  }}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200 ${
                    active
                      ? 'bg-black text-white shadow-md'
                      : isNavigating
                        ? 'bg-gray-100 text-gray-700'
                        : 'text-gray-700 hover:bg-gray-100 hover:shadow-sm'
                  }`}
                >
                  <span className={isNavigating ? 'animate-spin' : ''}>{item.icon}</span>
                  <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                    {item.name}
                  </span>
                </Link>
              );
            })}
          </nav>

          {/* Profile Section */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between gap-3">
              <Link href={ROUTES.PROFILE} className="flex-1 min-w-0 flex items-center gap-3">
                <div className="flex-shrink-0">
                  <svg
                    className="w-8 h-8 text-gray-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div className="flex flex-col min-w-0 flex-1">
                  <span className="text-sm font-semibold text-gray-900 truncate">
                    {userName || 'User'}
                  </span>
                  <span className="text-xs text-gray-500 truncate">{userEmail || ''}</span>
                </div>
              </Link>
              <button
                onClick={handleLogout}
                className="flex-shrink-0 p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
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
              </button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
