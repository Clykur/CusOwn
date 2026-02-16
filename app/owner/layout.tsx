'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import OwnerSidebar from '@/components/owner/owner-sidebar';
import MobileBottomNav from '@/components/owner/mobile-bottom-nav';
import { getUserState } from '@/lib/utils/user-state';
import { ROUTES } from '@/lib/utils/navigation';
import { Skeleton } from '@/components/ui/skeleton';

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const router = useRouter();
  const [checkingRole, setCheckingRole] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
      try {
        // Use canonical user-state util (cached) to decide access quickly
        const { shouldRedirect, redirectUrl } = await (async () => {
          try {
            const { getUserState } = await import('@/lib/utils/user-state');
            const {
              data: { session },
            } = await (await import('@/lib/supabase/auth')).supabaseAuth.auth.getSession();
            const userId = session?.user?.id || null;
            const state = await getUserState(userId);
            return {
              shouldRedirect: !state.canAccessOwnerDashboard && !!state.redirectUrl,
              redirectUrl: state.redirectUrl,
            };
          } catch (e) {
            return { shouldRedirect: false, redirectUrl: null };
          }
        })();

        if (shouldRedirect && redirectUrl) {
          router.replace(redirectUrl);
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
      <div className="min-h-screen flex items-center justify-center">
        <Skeleton className="h-8 w-48" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      <OwnerSidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />
      <div className="flex-1 lg:ml-64 pb-16 lg:pb-0">{children}</div>
      <MobileBottomNav sidebarOpen={sidebarOpen} />
    </div>
  );
}
