'use client';

import { useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';

/**
 * Hook to handle CusOwn logo/title click behavior.
 * - Customer -> /customer/dashboard
 * - Owner -> /owner/dashboard
 * - Admin -> /admin/dashboard
 * - Unauthenticated -> /#hero (or scroll to #hero if already on landing)
 */
export function useLogoNavigation() {
  const router = useRouter();
  const pathname = usePathname();

  const handleLogoClick = useCallback((e?: React.MouseEvent) => {
    if (e) e.preventDefault();

    // 1. Check for role cookie
    const getRole = () => {
      if (typeof document === 'undefined') return null;
      const m = document.cookie.match(/(?:^|;\s*)cusown_user_role=([^;]*)/);
      return m ? decodeURIComponent(m[1]) : null;
    };

    const role = getRole();

    // 2. Determine target path
    let targetPath: string;
    if (role === 'admin') {
      targetPath = '/admin/dashboard';
    } else if (role === 'owner') {
      targetPath = '/owner/dashboard';
    } else if (role === 'customer') {
      targetPath = '/customer/dashboard';
    } else {
      // Unauthenticated
      if (pathname === '/' || pathname === '/home') {
        const hero = document.getElementById('hero');
        if (hero) {
          hero.scrollIntoView({ behavior: 'smooth' });
          return;
        }
      }
      targetPath = '/#hero';
    }

    // 3. Navigate
    router.push(targetPath);
  }, [pathname, router]);

  return { handleLogoClick };
}
