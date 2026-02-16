'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import AuthButton from '@/components/auth/auth-button';

export default function Header() {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [userState, setUserState] = useState<any>(null);

  const onOwnerRoute = pathname?.startsWith('/owner');
  const onCustomerRoute = pathname?.startsWith('/customer');

  useEffect(() => {
    let mounted = true;
    const loadState = async () => {
      try {
        const { supabaseAuth } = await import('@/lib/supabase/auth');
        const { data } = await supabaseAuth.auth.getSession();
        const userId = data?.session?.user?.id || null;
        const { getUserState } = await import('@/lib/utils/user-state');
        const state = await getUserState(userId);
        if (!mounted) return;
        setUserState(state);
      } catch (err) {
        console.error('[HEADER] failed to load user state', err);
        if (!mounted) return;
        setUserState(null);
      } finally {
        if (!mounted) return;
        setChecking(false);
      }
    };

    // Only load user state when on owner/customer routes; keep header lightweight otherwise
    if (onOwnerRoute || onCustomerRoute) loadState();
    else setChecking(false);

    return () => {
      mounted = false;
    };
  }, [pathname, onOwnerRoute, onCustomerRoute]);

  // If on owner route, render Owner header on large screens only
  if (onOwnerRoute) {
    if (checking) return null;
    if (!userState?.canAccessOwnerDashboard) return null;

    return (
      <header className="hidden lg:block border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/owner/dashboard" className="text-lg font-semibold">
                Owner Dashboard
              </Link>
              <Link href="/owner/businesses" className="text-sm text-gray-600 hover:text-black">
                My Businesses
              </Link>
            </div>
            <nav className="flex items-center gap-4">
              <AuthButton />
            </nav>
          </div>
        </div>
      </header>
    );
  }

  // If on customer route, render Customer header on large screens only
  if (onCustomerRoute) {
    if (checking) return null;
    if (!userState?.canAccessCustomerDashboard) return null;

    return (
      <header className="hidden lg:block border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-4">
              <Link href="/customer/dashboard" className="text-lg font-semibold">
                My Bookings
              </Link>
              <Link href="/categories" className="text-sm text-gray-600 hover:text-black">
                Book a Service
              </Link>
            </div>
            <nav className="flex items-center gap-4">
              <AuthButton />
            </nav>
          </div>
        </div>
      </header>
    );
  }

  // Default header for public pages
  // Don't show header on admin/booking/select-role/profile/setup pages
  if (
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/booking/') ||
    pathname?.startsWith('/categories') ||
    pathname?.startsWith('/salon/') ||
    pathname === '/setup' ||
    pathname === '/profile' ||
    pathname === '/select-role'
  ) {
    return null;
  }

  return (
    <header className="hidden lg:block border-b border-gray-200 bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <span className="text-2xl font-bold text-black">CusOwn</span>
          </Link>

          <nav className="flex items-center gap-4">
            <AuthButton />
          </nav>
        </div>
      </div>
    </header>
  );
}
