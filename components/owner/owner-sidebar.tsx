'use client';

import { useState, useEffect, useMemo } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { ROUTES, getOwnerDashboardUrl } from '@/lib/utils/navigation';
import { UI_CONTEXT } from '@/config/constants';
import { useOwnerSession } from '@/components/owner/owner-session-context';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  requiresBusiness?: boolean;
}

export default function OwnerSidebar({
  sidebarOpen: propSidebarOpen,
  setSidebarOpen: propSetSidebarOpen,
}: {
  sidebarOpen?: boolean;
  setSidebarOpen?: (v: boolean) => void;
}) {
  const pathname = usePathname();
  const cleanPath = pathname.split('?')[0];

  // Support lifted state from parent (OwnerLayout) or fallback to internal state
  const [internalSidebarOpen, setInternalSidebarOpen] = useState(false);
  const sidebarOpen = propSidebarOpen ?? internalSidebarOpen;
  const setSidebarOpen = propSetSidebarOpen ?? setInternalSidebarOpen;
  const { initialUser } = useOwnerSession();
  const [navigating, setNavigating] = useState<string | null>(null);
  const [hasBusinesses, setHasBusinesses] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);

  const userEmail = initialUser?.email ?? '';
  const userName = initialUser?.full_name || initialUser?.email?.split('@')[0] || 'User';

  useEffect(() => {
    setNavigating(null);
  }, [pathname]);

  // Load business list for nav state only; user from layout.
  useEffect(() => {
    if (!initialUser?.id) {
      setHasBusinesses(false);
      setLoading(false);
      return;
    }
    let cancelled = false;
    fetch('/api/owner/businesses', { credentials: 'include' })
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (cancelled) return;
        const list = json?.data;
        setHasBusinesses(Array.isArray(list) && list.length > 0);
      })
      .catch(() => {
        if (!cancelled) setHasBusinesses(false);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, initialUser?.id]);

  // ===============================
  // Navigation items (UNCHANGED)
  // ===============================
  const navItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: '/owner/dashboard',
      requiresBusiness: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeWidth={2} d="M3 12l9-9 9 9v9a1 1 0 01-1 1h-5v-6h-6v6H4a1 1 0 01-1-1z" />
        </svg>
      ),
    },
    {
      name: 'My Businesses',
      href: '/owner/businesses',
      requiresBusiness: true,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeWidth={2} d="M4 21V3h16v18M9 7h1M9 11h1M9 15h1M14 7h1M14 11h1M14 15h1" />
        </svg>
      ),
    },
    {
      name: 'Create Business',
      href: '/setup',
      requiresBusiness: false,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
    },
  ];

  const navigation =
    hasBusinesses === false ? navItems.filter((i) => !i.requiresBusiness) : navItems;

  // ===============================
  // ✅ FIXED ACTIVE STATE (ONLY CHANGE)
  // ===============================
  const isActive = (name: string) => {
    // Dashboard
    if (name === 'Dashboard') {
      return cleanPath === '/owner/dashboard';
    }

    // My Businesses (list + individual business pages)
    if (name === 'My Businesses') {
      return (
        cleanPath === '/owner/businesses' ||
        (cleanPath.startsWith('/owner/') && cleanPath !== '/owner/dashboard')
      );
    }

    // Create Business
    if (name === 'Create Business') {
      return cleanPath === '/setup';
    }

    return false;
  };

  // ===============================
  // Render
  // ===============================
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
        className={`fixed top-0 left-0 z-50 h-screen w-64 bg-white border-r border-gray-200 transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="h-full flex flex-col">
          {/* Logo/Header */}
          <div className="p-6 border-b border-gray-200 flex items-start justify-between">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Business Owner</h2>
              <p className="text-sm text-gray-500 mt-1">{UI_CONTEXT.VIEWING_AS_OWNER}</p>
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
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto scrollbar-hide">
            {loading ? (
              <div className="flex justify-center py-10">
                <div className="animate-spin h-5 w-5 border-b-2 border-gray-400" />
              </div>
            ) : (
              navigation.map((item) => {
                const active = isActive(item.name);

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
                        : navigating === item.href
                          ? 'bg-gray-100 text-gray-700'
                          : 'text-gray-700 hover:bg-gray-100 hover:shadow-sm'
                    }`}
                  >
                    <span className={navigating === item.href ? 'animate-spin' : ''}>
                      {item.icon}
                    </span>
                    <span className="font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                      {item.name}
                    </span>
                  </Link>
                );
              })
            )}
          </nav>

          {/* Profile Section */}
          <div className="p-4 border-t border-gray-200">
            <div className="flex items-center justify-between gap-3">
              <Link
                href={ROUTES.PROFILE}
                className="flex-1 min-w-0 flex items-center gap-3"
                onClick={() => setSidebarOpen(false)}
              >
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
              <a
                href="/api/auth/signout"
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
              </a>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
