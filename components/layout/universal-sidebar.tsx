'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/utils/navigation';
import MobileBottomNav from '@/components/owner/mobile-bottom-nav';
import CustomerMobileBottomNav from '@/components/customer/mobile-bottom-nav';
import { supabaseAuth } from '@/lib/supabase/auth';
import { getUserState } from '@/lib/utils/user-state';
import AdminSidebar from '@/components/admin/admin-sidebar';
import OwnerSidebar from '@/components/owner/owner-sidebar';
import CustomerSidebar from '@/components/customer/customer-sidebar';

export default function UniversalSidebar() {
  const pathname = usePathname();
  const [sidebarType, setSidebarType] = useState<'admin' | 'owner' | 'customer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    const determineSidebar = async () => {
      // Pages that manage their own layout (including /customer/dashboard via CustomerLayout)
      if (
        pathname?.startsWith('/admin') ||
        pathname?.startsWith('/owner') ||
        pathname?.startsWith('/customer') ||
        pathname === '/' ||
        pathname?.startsWith('/auth') ||
        pathname === '/select-role'
      ) {
        setSidebarType(null);
        setLoading(false);
        return;
      }

      try {
        const {
          data: { session },
        } = await supabaseAuth.auth.getSession();

        // CUSTOMER FLOW ROUTES ALWAYS USE CUSTOMER SIDEBAR
        if (
          pathname?.startsWith('/categories') ||
          pathname?.startsWith('/salon') ||
          pathname?.startsWith('/booking')
        ) {
          setSidebarType('customer');
          setLoading(false);
          return;
        }

        // Not logged in
        if (!session?.user) {
          setSidebarType(null);
          setLoading(false);
          return;
        }

        // Role-based fallback for public customer routes (categories, salon, booking)
        const state = await getUserState(session.user.id);

        if (state.userType === 'admin') {
          setSidebarType('admin');
        } else {
          // All non-admin public routes default to customer sidebar
          setSidebarType('customer');
        }
      } catch {
        setSidebarType(null);
      } finally {
        setLoading(false);
      }
    };

    determineSidebar();
  }, [pathname]);

  if (loading || !sidebarType) return null;

  const cleanPath = pathname?.split('?')[0] || '';
  const allowMobileHeader =
    (sidebarType === 'owner' && (cleanPath === ROUTES.SETUP || cleanPath === ROUTES.PROFILE)) ||
    (sidebarType === 'customer' && cleanPath === ROUTES.CUSTOMER_DASHBOARD);

  const isStaticSidebarPage = cleanPath === '/setup' || cleanPath === '/profile';

  // Get correct title for pages
  const getMobileHeaderTitle = () => {
    if (cleanPath === ROUTES.SETUP) return 'Create Business';
    if (cleanPath === ROUTES.PROFILE) return 'Profile';
    if (cleanPath === ROUTES.CUSTOMER_DASHBOARD) return 'My Bookings';
    if (cleanPath === ROUTES.CATEGORIES) return 'Book Appointment';
    if (cleanPath === ROUTES.SALON_LIST) return 'Browse Salons';
    if (cleanPath?.startsWith('/salon/')) return 'Salon Details';
    if (cleanPath?.startsWith('/booking/')) return 'Booking Details';
    return 'Menu';
  };

  return (
    <>
      {/* Mobile Header (shown on non-static pages for Owner and Customer) */}
      {!isStaticSidebarPage && (sidebarType === 'owner' || sidebarType === 'customer') && (
        <div className="lg:hidden block">
          {mobileOpen === false && (
            <div className="px-4 pt-4">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setMobileOpen(true)}
                  className="p-2.5 bg-white border-2 border-gray-200 rounded-xl shadow-sm hover:shadow transition-all"
                  aria-label="Open menu"
                >
                  <svg
                    className="w-6 h-6 text-gray-700"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 6h16M4 12h16M4 18h16"
                    />
                  </svg>
                </button>
                {/* Mobile page title aligned with hamburger */}
                <div>
                  <h1 className="text-2xl font-semibold">{getMobileHeaderTitle()}</h1>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Mobile Overlay (shown for non-static pages) */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar: always fixed so it does not scroll with page content (profile, setup, etc.) */}
      <aside
        className={`
    fixed top-0 left-0 z-50 h-screen w-64 bg-white
    transition-transform duration-300
    ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
    lg:translate-x-0
  `}
      >
        {sidebarType === 'customer' ? (
          <CustomerSidebar sidebarOpen={mobileOpen} setSidebarOpen={setMobileOpen} />
        ) : sidebarType === 'owner' ? (
          <OwnerSidebar sidebarOpen={mobileOpen} setSidebarOpen={setMobileOpen} />
        ) : (
          <AdminSidebar />
        )}
      </aside>

      {/* Mobile footers for Owner and Customer */}
      {!mobileOpen && sidebarType === 'owner' && (
        <div className="lg:hidden">
          <MobileBottomNav />
        </div>
      )}

      {!mobileOpen && sidebarType === 'customer' && (
        <div className="lg:hidden">
          <CustomerMobileBottomNav />
        </div>
      )}
    </>
  );
}
