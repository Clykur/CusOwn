'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CustomerSidebar from '@/components/customer/customer-sidebar';
import CustomerHeader from '@/components/customer/customer-header';
import CustomerMobileBottomNav from '@/components/customer/mobile-bottom-nav';
import { Skeleton } from '@/components/ui/skeleton';

export default function CustomerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
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
        if (!state.canAccessCustomerDashboard && state.redirectUrl) {
          router.replace(state.redirectUrl);
          return;
        }
      } catch (err) {
        console.error('[CUSTOMER_LAYOUT] access check failed', err);
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

  return (
    <div className="min-h-screen bg-white flex overflow-x-hidden">
      {/* <CustomerSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} /> */}
      <main className="flex-1 lg:ml-64">
        <div className="px-4 sm:px-6 lg:px-8 py-8 lg:pl-0">
          <CustomerHeader title="My Bookings" subtitle="Manage your bookings and appointments" />
          {children}
        </div>
      </main>
      <CustomerMobileBottomNav sidebarOpen={sidebarOpen} />
    </div>
  );
}
