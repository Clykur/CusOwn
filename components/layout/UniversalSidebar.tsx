'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { supabaseAuth } from '@/lib/supabase/auth';
import { getUserState } from '@/lib/utils/user-state';
import AdminSidebar from '@/components/admin/AdminSidebar';
import OwnerSidebar from '@/components/owner/OwnerSidebar';
import CustomerSidebar from '@/components/customer/CustomerSidebar';

export default function UniversalSidebar() {
  const pathname = usePathname();
  const [sidebarType, setSidebarType] = useState<'admin' | 'owner' | 'customer' | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const determineSidebar = async () => {
      // Pages that already have sidebars via layouts - let layouts handle it
      // UniversalSidebar will show for pages without layout sidebars
      if (
        pathname?.startsWith('/admin') ||
        pathname?.startsWith('/owner') ||
        pathname?.startsWith('/customer')
      ) {
        // These routes have layout sidebars, so don't show universal sidebar
        setSidebarType(null);
        setLoading(false);
        return;
      }

      // Public pages don't need sidebars
      if (
        pathname === '/' ||
        pathname?.startsWith('/b/') ||
        pathname?.startsWith('/auth/') ||
        pathname === '/select-role'
      ) {
        setSidebarType(null);
        setLoading(false);
        return;
      }

      // For other pages (profile, setup, categories, salon, booking, etc.), determine based on user role
      if (!supabaseAuth) {
        // For public browsing pages, show customer sidebar
        if (pathname?.startsWith('/categories') || pathname?.startsWith('/salon/') || pathname?.startsWith('/booking/')) {
          setSidebarType('customer');
        } else {
          setSidebarType(null);
        }
        setLoading(false);
        return;
      }

      try {
        const { data: { session } } = await supabaseAuth.auth.getSession();
        if (!session?.user) {
          // For public browsing pages, show customer sidebar
          if (pathname?.startsWith('/categories') || pathname?.startsWith('/salon/') || pathname?.startsWith('/booking/')) {
            setSidebarType('customer');
          } else {
            setSidebarType(null);
          }
          setLoading(false);
          return;
        }

        const stateResult = await getUserState(session.user.id);
        
        // Determine sidebar based on user type and page
        if (stateResult.userType === 'admin') {
          setSidebarType('admin');
        } else if (stateResult.userType === 'owner' || stateResult.userType === 'both') {
          // For profile, setup, and other owner-accessible pages
          if (pathname === '/profile' || pathname === '/setup') {
            setSidebarType('owner');
          } else {
            // Default to customer sidebar for browsing pages
            setSidebarType('customer');
          }
        } else if (stateResult.userType === 'customer') {
          setSidebarType('customer');
        } else {
          // No profile yet - show customer sidebar for browsing
          if (pathname?.startsWith('/categories') || pathname?.startsWith('/salon/') || pathname?.startsWith('/booking/')) {
            setSidebarType('customer');
          } else {
            setSidebarType(null);
          }
        }
      } catch (err) {
        console.error('[UniversalSidebar] Error determining sidebar:', err);
        // Fallback: show customer sidebar for browsing pages
        if (pathname?.startsWith('/categories') || pathname?.startsWith('/salon/') || pathname?.startsWith('/booking/')) {
          setSidebarType('customer');
        } else {
          setSidebarType(null);
        }
      } finally {
        setLoading(false);
      }
    };

    determineSidebar();
  }, [pathname]);

  if (loading) {
    return null; // Don't show sidebar while loading
  }

  if (!sidebarType) {
    return null; // No sidebar for public pages
  }

  // Extract booking link for owner sidebar
  const bookingLinkMatch = pathname?.match(/^\/owner\/([^\/]+)$/);
  const bookingLink = bookingLinkMatch ? bookingLinkMatch[1] : undefined;

  switch (sidebarType) {
    case 'admin':
      return <AdminSidebar />;
    case 'owner':
      return <OwnerSidebar bookingLink={bookingLink} />;
    case 'customer':
      return <CustomerSidebar />;
    default:
      return null;
  }
}
