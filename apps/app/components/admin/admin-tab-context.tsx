'use client';

import { createContext, useContext, useMemo } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

export type AdminTabValue =
  | 'overview'
  | 'businesses'
  | 'users'
  | 'bookings'
  | 'audit'
  | 'cron-monitor'
  | 'auth-management'
  | 'storage'
  | 'success-metrics'
  | 'analytics';

const VALID_TABS: AdminTabValue[] = [
  'overview',
  'businesses',
  'users',
  'bookings',
  'audit',
  'cron-monitor',
  'auth-management',
  'storage',
  'success-metrics',
  'analytics',
];

const AdminTabContext = createContext<AdminTabValue>('overview');

/**
 * Single consumer of useSearchParams for admin tab. Used by sidebar and dashboard
 * to avoid multiple useSearchParams() call sites that can trigger repeated RSC refetches.
 */
export function AdminTabProvider({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const tabParam = searchParams?.get('tab') ?? '';
  const value = useMemo<AdminTabValue>(() => {
    if (pathname !== '/admin/dashboard') return 'overview';
    return (VALID_TABS as string[]).includes(tabParam) ? (tabParam as AdminTabValue) : 'overview';
  }, [pathname, tabParam]);

  return <AdminTabContext.Provider value={value}>{children}</AdminTabContext.Provider>;
}

export function useAdminTab(): AdminTabValue {
  const ctx = useContext(AdminTabContext);
  return ctx ?? 'overview';
}
