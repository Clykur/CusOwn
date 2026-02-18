'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import OwnerSidebar from '@/components/owner/owner-sidebar';
import MobileBottomNav from '@/components/owner/mobile-bottom-nav';
import OwnerHeader from '@/components/owner/owner-header';
import { Skeleton } from '@/components/ui/skeleton';

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [checkingRole, setCheckingRole] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        const { getUserState } = await import('@/lib/utils/user-state');
        const { supabaseAuth } = await import('@/lib/supabase/auth');
        const {
          data: { session },
        } = await supabaseAuth.auth.getSession();
        const userId = session?.user?.id || null;
        const state = await getUserState(userId);
        if (!state.canAccessOwnerDashboard && state.redirectUrl) {
          router.replace(state.redirectUrl);
          return;
        }
      } catch (err) {
        console.error('[OWNER_LAYOUT] access check failed', err);
      } finally {
        setCheckingRole(false);
      }
    };
    checkAccess();
  }, [router]);

  if (checkingRole) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-6">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
      </div>
    );
  }

  // Determine if current page is Owner Dashboard
  const isDashboard = pathname === '/owner/dashboard';
  // Determine if current page is Profile or Create Business
  const isProfile = pathname === '/owner/profile';
  const isCreateBusiness = pathname === '/owner/setup';

  // Add spacing for Profile and Create Business pages on large screens
  const mainSpacing = isProfile || isCreateBusiness ? 'lg:pl-12 lg:pr-12' : '';

  return (
    <div className="min-h-screen bg-white flex overflow-x-hidden">
      <OwnerSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <main className={`flex-1 lg:ml-64 ${mainSpacing}`}>
        <div className="px-4 sm:px-6 lg:px-8 py-8">
          {isDashboard && (
            <OwnerHeader title="Owner Dashboard" subtitle="Manage your businesses and bookings" />
          )}
          {children}
        </div>
      </main>
      <MobileBottomNav sidebarOpen={sidebarOpen} />
    </div>
  );
}
