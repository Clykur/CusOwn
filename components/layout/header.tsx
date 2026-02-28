'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

function Header() {
  const pathname = usePathname();
  const [checking, setChecking] = useState(true);
  const [userState, setUserState] = useState<any>(null);

  const onOwnerRoute = pathname?.startsWith('/owner');
  const onCustomerRoute = pathname?.startsWith('/customer');

  const hiddenRoutes = ['/select-role'];

  const hideCompletely =
    pathname?.startsWith('/admin') ||
    pathname?.startsWith('/booking') ||
    hiddenRoutes.includes(pathname || '');

  useEffect(() => {
    let mounted = true;

    const loadState = async () => {
      try {
        const stateRes = await fetch('/api/user/state', {
          credentials: 'include',
        });
        if (!stateRes.ok) {
          if (!mounted) return;
          setUserState(null);
          return;
        }
        const json = await stateRes.json();
        const state = json?.data;
        if (!mounted) return;
        setUserState(state ?? null);
      } catch {
        if (!mounted) return;
        setUserState(null);
      } finally {
        if (!mounted) return;
        setChecking(false);
      }
    };

    if (onOwnerRoute || onCustomerRoute) loadState();
    else setChecking(false);

    return () => {
      mounted = false;
    };
  }, [pathname, onOwnerRoute, onCustomerRoute]);

  if (hideCompletely) return null;

  // OWNER ROUTES
  if (onOwnerRoute) {
    if (checking || !userState?.canAccessOwnerDashboard) {
      return (
        <header className="h-14 flex items-center justify-center px-4 border-b bg-white lg:hidden">
          <h1 className="text-xl font-calegar font-semibold uppercase">CUSOWN</h1>
        </header>
      );
    }

    return (
      <header className="h-14 flex items-center justify-center px-4 border-b bg-white lg:hidden">
        <h1 className="text-xl font-calegar font-semibold uppercase">CUSOWN</h1>
      </header>
    );
  }

  // CUSTOMER ROUTES
  if (onCustomerRoute) {
    if (checking || !userState?.canAccessCustomerDashboard) {
      return (
        <header className="h-14 flex items-center justify-center px-4 border-b bg-white lg:hidden">
          <h1 className="text-xl font-calegar font-semibold uppercase">CUSOWN</h1>
        </header>
      );
    }

    return (
      <header className="h-14 flex items-center justify-center px-4 border-b bg-white lg:hidden">
        <h1 className="text-xl font-calegar font-semibold uppercase">CUSOWN</h1>
      </header>
    );
  }

  // PUBLIC ROUTES — Mobile Only
  return (
    <header className="h-14 flex items-center justify-center px-4 border-b bg-white lg:hidden">
      <h1 className="text-xl font-calegar font-semibold uppercase">CUSOWN</h1>
    </header>
  );
}

export default Header;
export { Header };
