'use client';

import { useState, useEffect } from 'react';
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
  const loading = false;

  const userEmail = initialUser?.email ?? '';
  const userName = initialUser?.full_name || initialUser?.email?.split('@')[0] || 'User';

  useEffect(() => {
    setNavigating(null);
  }, [pathname]);

  // Load business list for nav state only; user from layout.
  useEffect(() => {
    if (!initialUser?.id) {
      setHasBusinesses(false);
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
  ];

  const navigation =
    hasBusinesses === false ? navItems.filter((i) => !i.requiresBusiness) : navItems;

  // ===============================
  // STRICT ACTIVE STATE LOGIC (EXACT MATCH ONLY)
  // ===============================
  const isActive = (href: string) => cleanPath === href;

  // ===============================
  // Render
  // ===============================
  return (
    <>
      {/* Sidebar overlay for mobile/medium screens: hide sidebar below lg */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar - only visible on desktop (lg and up) */}
      <aside
        className={`hidden lg:block fixed top-0 left-0 z-50 h-screen w-64 bg-slate-50 border-r border-slate-200 transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0`}
      >
        <div className="flex h-full flex-col">
          {/* Logo/Header */}
          <div className="flex shrink-0 items-start justify-between border-b border-slate-200 px-5 py-6">
            <div>
              <h2 className="text-lg font-semibold tracking-tight text-slate-900">CusOwn</h2>
              <p className="mt-0.5 text-xs text-slate-500">{UI_CONTEXT.VIEWING_AS_OWNER}</p>
            </div>
          </div>

          {/* Navigation - match admin sidebar style */}
          <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-6">
            {navigation.map((item) => {
              const active = isActive(item.href);
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
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors duration-150 ${
                    active
                      ? 'border-l-2 border-slate-900 bg-slate-200/60 font-medium text-slate-900'
                      : 'border-l-2 border-transparent text-slate-600 hover:bg-slate-200/40 hover:text-slate-900'
                  }`}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center [&>svg]:h-5 [&>svg]:w-5">
                    {item.icon}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* Profile Section - match admin sidebar; Profile keeps sidebar, Logout icon */}
          <div className="shrink-0 border-t border-slate-200 p-4">
            <div className="flex items-center justify-between gap-3">
              <Link
                href={ROUTES.OWNER_PROFILE}
                className="min-w-0 flex-1 flex items-center gap-3"
                onClick={() => setSidebarOpen(false)}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-600">
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                    />
                  </svg>
                </div>
                <div className="min-w-0 flex-1 flex flex-col">
                  <span className="truncate text-sm font-medium text-slate-900">
                    {userName || 'User'}
                  </span>
                  <span className="truncate text-xs text-slate-500">{userEmail || ''}</span>
                </div>
              </Link>
              <a
                href={`/api/auth/signout?redirect_to=${encodeURIComponent(ROUTES.SELECT_ROLE('owner'))}`}
                className="shrink-0 rounded-lg p-2 text-slate-500 transition-colors hover:bg-slate-200/60 hover:text-slate-900"
                title="Sign out"
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
