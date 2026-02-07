'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { signOut, getUserProfile } from '@/lib/supabase/auth';
import { ROUTES, getOwnerDashboardUrl } from '@/lib/utils/navigation';
import { supabaseAuth } from '@/lib/supabase/auth';
import { getUserState } from '@/lib/utils/user-state';
import { UI_CONTEXT } from '@/config/constants';

interface NavItem {
  name: string;
  href: string;
  icon: React.ReactNode;
  requiresBusiness?: boolean; // Only show if user has businesses
}

interface OwnerSidebarProps {
  bookingLink?: string;
}

export default function OwnerSidebar({ bookingLink }: OwnerSidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navigating, setNavigating] = useState<string | null>(null);
  const [hasBusinesses, setHasBusinesses] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [firstBusinessLink, setFirstBusinessLink] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string>('');
  const [userName, setUserName] = useState<string>('');

  // Check user state to determine which nav items to show
  useEffect(() => {
    const checkUserState = async () => {
      if (!supabaseAuth) {
        setLoading(false);
        return;
      }

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

          const stateResult = await getUserState(session.user.id);
          setHasBusinesses(stateResult.businessCount > 0);

          // If user has businesses and we're on /owner/dashboard, fetch first business link
          // This ensures the Dashboard link points to a specific business dashboard
          if (
            stateResult.businessCount > 0 &&
            pathname === ROUTES.OWNER_DASHBOARD_BASE &&
            !firstBusinessLink
          ) {
            try {
              const response = await fetch('/api/owner/businesses', {
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                },
              });
              if (response.ok) {
                const result = await response.json();
                if (result.success && result.data && result.data.length > 0) {
                  const bookingLink = result.data[0].booking_link;
                  console.log('[OwnerSidebar] Setting first business link:', bookingLink);
                  setFirstBusinessLink(bookingLink);
                }
              }
            } catch (err) {
              console.error('[OwnerSidebar] Error fetching businesses:', err);
            }
          }
        } else {
          setHasBusinesses(false);
        }
      } catch (error) {
        console.error('[OwnerSidebar] Error checking user state:', error);
        setHasBusinesses(false);
      } finally {
        setLoading(false);
      }
    };

    checkUserState();

    // Listen for business creation events
    const handleBusinessCreated = async () => {
      // Clear cache when business is created
      const { clearUserStateCache } = await import('@/lib/utils/user-state');
      clearUserStateCache();
      checkUserState();
    };

    window.addEventListener('businessCreated', handleBusinessCreated);
    window.addEventListener('storage', (e) => {
      if (e.key === 'business_created' || e.key === 'user_state_changed') {
        checkUserState();
      }
    });

    return () => {
      window.removeEventListener('businessCreated', handleBusinessCreated);
    };
  }, [pathname, firstBusinessLink]);

  // Memoize dashboard href to prevent it from changing on every render
  const dashboardHref = useMemo(() => {
    // If we have a bookingLink (on specific business page), use it
    if (bookingLink) {
      return getOwnerDashboardUrl(bookingLink);
    }

    // If we're on /owner/dashboard and have firstBusinessLink, navigate to first business
    if (pathname === ROUTES.OWNER_DASHBOARD_BASE && firstBusinessLink) {
      const href = getOwnerDashboardUrl(firstBusinessLink);
      console.log(
        '[OwnerSidebar] Dashboard href pointing to first business:',
        firstBusinessLink,
        '->',
        href
      );
      return href;
    }

    // If we're on /owner/dashboard but don't have firstBusinessLink yet, still return dashboard
    // The link will be updated once firstBusinessLink is loaded
    return ROUTES.OWNER_DASHBOARD_BASE;
  }, [bookingLink, pathname, firstBusinessLink]);

  // Define all navigation items
  const allNavigationItems: NavItem[] = [
    {
      name: 'Dashboard',
      href: `${ROUTES.OWNER_DASHBOARD_BASE}?tab=dashboard`,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
          />
        </svg>
      ),
      requiresBusiness: true,
    },
    {
      name: 'My Businesses',
      href: `${ROUTES.OWNER_DASHBOARD_BASE}?tab=businesses`,
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
      requiresBusiness: true,
    },
    {
      name: 'Create Business',
      href: ROUTES.SETUP,
      icon: (
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
      ),
      requiresBusiness: false, // Always show
    },
  ];

  // Filter navigation based on user state
  // If user has no businesses, only show "Create Business"
  // If user has businesses, show all items
  const navigation =
    hasBusinesses === false
      ? allNavigationItems.filter((item) => !item.requiresBusiness)
      : allNavigationItems;

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
    // Clear navigating state when pathname changes
    setNavigating(null);
  }, [pathname]);

  const isActive = (href: string, itemName: string) => {
    if (!pathname) return false;

    // Normalize paths for comparison (remove query params and trailing slashes)
    const normalizedPathname = pathname.split('?')[0].replace(/\/$/, '') || '';
    const normalizedHref = href.split('?')[0].replace(/\/$/, '') || '';

    // Setup page: exact match
    if (itemName === 'Create Business' || normalizedHref === '/setup' || href === '/setup') {
      return normalizedPathname === '/setup' || pathname === '/setup';
    }

    // Dashboard: active when on /owner/dashboard with tab=dashboard or no tab, OR on specific business dashboard
    if (itemName === 'Dashboard') {
      if (normalizedPathname === '/owner/dashboard') {
        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab');
        return tab === 'dashboard' || !tab; // Default to dashboard if no tab
      }

      // Active if on a specific business dashboard
      if (bookingLink) {
        const expectedUrl = getOwnerDashboardUrl(bookingLink);
        const normalizedExpected = expectedUrl.split('?')[0].replace(/\/$/, '');
        return (
          normalizedPathname === normalizedExpected ||
          normalizedPathname?.startsWith(`/owner/${bookingLink}`)
        );
      }

      // If no bookingLink, check if we're on a specific business dashboard (not /owner/dashboard)
      const ownerMatch = normalizedPathname.match(/^\/owner\/([^\/]+)$/);
      if (ownerMatch && ownerMatch[1] !== 'dashboard') {
        return true; // We're on a specific business dashboard
      }

      return false; // Not on a specific business dashboard
    }

    // My Businesses: active when on /owner/dashboard with tab=businesses
    if (itemName === 'My Businesses') {
      if (normalizedPathname === '/owner/dashboard') {
        const urlParams = new URLSearchParams(window.location.search);
        const tab = urlParams.get('tab');
        return tab === 'businesses';
      }
      return false;
    }

    // Default: exact match or starts with
    return (
      normalizedPathname === normalizedHref || normalizedPathname?.startsWith(normalizedHref + '/')
    );
  };

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 bg-white border border-gray-300 rounded-lg shadow-md"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {sidebarOpen ? (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            ) : (
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 6h16M4 12h16M4 18h16"
              />
            )}
          </svg>
        </button>
      </div>

      {/* Sidebar overlay for mobile */}
      {sidebarOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 left-0 z-40 h-screen w-64 bg-white border-r border-gray-200 transition-transform ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:translate-x-0 pb-16 lg:pb-0`}
      >
        <div className="h-full flex flex-col">
          {/* Logo/Header */}
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-xl font-bold text-gray-900">Business Owner</h2>
            <p className="text-sm text-gray-500 mt-1">{UI_CONTEXT.VIEWING_AS_OWNER}</p>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gray-400"></div>
              </div>
            ) : (
              navigation.map((item) => {
                const active = isActive(item.href, item.name);
                const normalizedPathname = pathname?.split('?')[0]?.replace(/\/$/, '') || '';
                const normalizedHref = item.href.split('?')[0]?.replace(/\/$/, '') || '';

                // Only show navigating state if we're actually going to a different page
                const isNavigating =
                  navigating === item.href && normalizedHref !== normalizedPathname;

                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={(e) => {
                      // Special handling for Dashboard link when on /owner/dashboard
                      if (item.name === 'Dashboard' && pathname === ROUTES.OWNER_DASHBOARD_BASE) {
                        // If we have firstBusinessLink, navigate to it programmatically
                        if (firstBusinessLink) {
                          e.preventDefault();
                          const targetUrl = getOwnerDashboardUrl(firstBusinessLink);
                          console.log(
                            '[OwnerSidebar] Navigating to first business dashboard:',
                            targetUrl
                          );
                          setNavigating(targetUrl);
                          setSidebarOpen(false);
                          router.push(targetUrl);
                          return;
                        }
                        // If no firstBusinessLink yet, prevent navigation (stay on current page)
                        e.preventDefault();
                        setNavigating(null);
                        return;
                      }

                      // For other links, only set navigating if we're actually navigating to a different page
                      if (normalizedHref !== normalizedPathname) {
                        setNavigating(item.href);
                        setSidebarOpen(false);
                      } else {
                        // If already on this page, clear any navigating state
                        setNavigating(null);
                      }
                    }}
                    className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
                      active ? 'bg-black text-white' : 'text-gray-700 hover:bg-gray-100'
                    }`}
                    aria-current={active ? 'page' : undefined}
                  >
                    <span className={`flex-shrink-0 ${isNavigating ? 'animate-spin' : ''}`}>
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
