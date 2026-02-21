'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { ROUTES } from '@/lib/utils/navigation';

const AdminSidebar = dynamic(
  () => import('@/components/admin/admin-sidebar').then((m) => m.default),
  { ssr: false }
);
const OwnerSidebar = dynamic(
  () => import('@/components/owner/owner-sidebar').then((m) => m.default),
  { ssr: false }
);
const CustomerSidebar = dynamic(
  () => import('@/components/customer/customer-sidebar').then((m) => m.default),
  { ssr: false }
);
const MobileBottomNav = dynamic(
  () => import('@/components/owner/mobile-bottom-nav').then((m) => m.default),
  { ssr: false }
);
const CustomerMobileBottomNav = dynamic(
  () => import('@/components/customer/mobile-bottom-nav').then((m) => m.default),
  { ssr: false }
);

export default function UniversalSidebar() {
  const pathname = usePathname();
  const cleanPath = pathname?.split('?')[0] || '';
  const pathRef = useRef<string | null>(null);
  const [sidebarType, setSidebarType] = useState<'admin' | 'owner' | 'customer' | null>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    if (pathRef.current === cleanPath && sidebarType !== null) {
      setLoading(false);
      return;
    }
    pathRef.current = cleanPath;

    const determineSidebar = async () => {
      try {
        // Public pages with no sidebar
        if (cleanPath === '/' || cleanPath.startsWith('/auth') || cleanPath === '/select-role') {
          setSidebarType(null);
          return;
        }

        // Admin routes
        if (cleanPath.startsWith('/admin')) {
          setSidebarType('admin');
          return;
        }

        // Owner explicit routes
        if (cleanPath.startsWith('/owner')) {
          sessionStorage.setItem('ui-context', 'owner');
          setSidebarType('owner');
          return;
        }

        // Setup page → treat as owner
        if (cleanPath === ROUTES.SETUP) {
          sessionStorage.setItem('ui-context', 'owner');
          setSidebarType('owner');
          return;
        }

        // Customer flow routes
        if (
          cleanPath.startsWith('/categories') ||
          cleanPath.startsWith('/salon') ||
          cleanPath.startsWith('/booking') ||
          cleanPath.startsWith('/customer')
        ) {
          sessionStorage.setItem('ui-context', 'customer');
          setSidebarType('customer');
          return;
        }

        // Handle common profile page using stored context
        if (cleanPath === ROUTES.PROFILE) {
          const context = sessionStorage.getItem('ui-context');
          if (context === 'owner') {
            setSidebarType('owner');
            return;
          }
          if (context === 'customer') {
            setSidebarType('customer');
            return;
          }
        }

        // Fallback based on logged-in role (server endpoint)
        const stateRes = await fetch('/api/user/state', { credentials: 'include' });
        if (!stateRes.ok) {
          setSidebarType(null);
          return;
        }
        const stateJson = await stateRes.json();
        const state = stateJson?.data;
        if (!state?.authenticated) {
          setSidebarType(null);
          return;
        }
        if (state.userType === 'admin') {
          setSidebarType('admin');
        } else if (state.userType === 'owner') {
          setSidebarType('owner');
        } else {
          setSidebarType('customer');
        }
      } catch {
        setSidebarType(null);
      } finally {
        setLoading(false);
      }
    };

    determineSidebar();
  }, [cleanPath, sidebarType]);

  if (loading || !sidebarType) return null;

  const getMobileHeaderTitle = () => {
    // Owner base dashboard
    if (cleanPath === ROUTES.OWNER_DASHBOARD_BASE) {
      return 'Owner Dashboard';
    }

    // Owner dynamic business dashboard (/owner/{bookingLink})
    if (cleanPath.startsWith('/owner/') && cleanPath !== '/owner/businesses') {
      return 'Owner Dashboard';
    }

    // Owner businesses list
    if (cleanPath === '/owner/businesses') {
      return 'My Businesses';
    }

    if (cleanPath === ROUTES.SETUP) return 'Create Business';
    if (cleanPath === ROUTES.PROFILE) return 'Profile';

    // Customer
    if (cleanPath === ROUTES.CUSTOMER_DASHBOARD) {
      return 'My Bookings';
    }

    if (cleanPath === ROUTES.CATEGORIES) return 'Book Appointment';
    if (cleanPath === ROUTES.SALON_LIST) return 'Browse Salons';
    if (cleanPath.startsWith('/salon/')) return 'Salon Details';
    if (cleanPath.startsWith('/booking/')) return 'Booking Details';

    return null;
  };

  return (
    <>
      {(sidebarType === 'owner' || sidebarType === 'customer') && (
        <div className="md:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b">
          {/* Centered app title for mobile (no hamburger, no per-role title) */}
          <div className="h-14 flex items-center justify-center px-4">
            <h1 className="text-xl md:text-2xl font-calegar font-semibold tracking-tight hover:opacity-80 transition-opacity uppercase">
              CUSOWN
            </h1>
          </div>
        </div>
      )}

      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

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

      {!mobileOpen && sidebarType === 'owner' && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t">
          <MobileBottomNav />
        </div>
      )}

      {!mobileOpen && sidebarType === 'customer' && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t">
          <CustomerMobileBottomNav />
        </div>
      )}
    </>
  );
}
