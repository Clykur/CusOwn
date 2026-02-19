'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import AuthButton from '@/components/auth/auth-button';

function Header() {
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

  // If on owner route, render Owner header: mobile (below md) + desktop (md and above)
  if (onOwnerRoute) {
    // Desktop header requires permission; mobile header is lightweight and shown regardless
    if (checking) {
      // still render mobile header while checking permissions
      return (
        <header className="h-14 flex items-center justify-center md:justify-between px-4 border-b bg-white md:hidden">
          <h1 className="text-xl md:text-2xl font-calegar font-semibold tracking-tight hover:opacity-80 transition-opacity uppercase">
            CUSOWN
          </h1>
        </header>
      );
    }
    if (!userState?.canAccessOwnerDashboard)
      return (
        <header className="h-14 flex items-center justify-center md:justify-between px-4 border-b bg-white md:hidden">
          <h1 className="text-xl md:text-2xl font-calegar font-semibold tracking-tight hover:opacity-80 transition-opacity uppercase">
            CUSOWN
          </h1>
        </header>
      );

    const ownerTitleMap: Record<string, string> = {
      '/owner/dashboard': 'Dashboard',
      '/owner/businesses': 'My Businesses',
      '/owner/create-business': 'Create Business',
      '/owner/profile': 'Profile',
    };

    const pageTitle = ownerTitleMap[pathname] || 'Dashboard';

    return (
      <>
        <header className="h-14 flex items-center justify-center md:justify-between px-4 border-b bg-white md:hidden">
          <h1 className="text-xl md:text-2xl font-calegar font-semibold tracking-tight hover:opacity-80 transition-opacity uppercase">
            CUSOWN
          </h1>
        </header>
      </>
    );
  }

  // If on customer route, render Customer header: mobile (below md) + desktop (md and above)
  if (onCustomerRoute) {
    if (checking) {
      return (
        <header className="h-14 flex items-center justify-center md:justify-between px-4 border-b bg-white md:hidden">
          <h1 className="text-xl md:text-2xl font-calegar font-semibold tracking-tight hover:opacity-80 transition-opacity uppercase">
            CUSOWN
          </h1>
        </header>
      );
    }
    if (!userState?.canAccessCustomerDashboard)
      return (
        <header className="h-14 flex items-center justify-center md:justify-between px-4 border-b bg-white md:hidden">
          <h1 className="text-xl md:text-2xl font-calegar font-semibold tracking-tight hover:opacity-80 transition-opacity uppercase">
            CUSOWN
          </h1>
        </header>
      );

    return (
      <>
        <header className="h-14 flex items-center justify-center md:justify-between px-4 border-b bg-white md:hidden">
          <h1 className="text-xl md:text-2xl font-calegar font-semibold tracking-tight hover:opacity-80 transition-opacity uppercase">
            CUSOWN
          </h1>
        </header>
      </>
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
    <>
      <header className="h-14 flex items-center justify-center md:justify-between px-4 border-b bg-white md:hidden">
        <h1 className="text-xl md:text-2xl font-calegar font-semibold tracking-tight hover:opacity-80 transition-opacity uppercase">
          CUSOWN
        </h1>
      </header>

      <header className="hidden md:block border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
              <span className="text-xl md:text-2xl font-calegar font-semibold tracking-tight hover:opacity-80 transition-opacity uppercase">
                CusOwn
              </span>
            </Link>

            <nav className="flex items-center gap-4">
              <AuthButton />
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}

export default Header;
export { Header };
