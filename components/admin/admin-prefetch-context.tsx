'use client';

import { createContext, useContext, useCallback } from 'react';
import {
  setAdminCache,
  getAdminCached,
  ADMIN_CACHE_KEYS,
  getAdminAnalyticsCacheKey,
} from '@/components/admin/admin-cache';
import { adminFetch } from '@/lib/utils/admin-fetch.client';

const LIST_LIMIT = 25;
const OVERVIEW_DAYS = 30;

type PrefetchContextValue = {
  prefetchTab: (tab: string) => void;
};

const AdminPrefetchContext = createContext<PrefetchContextValue | null>(null);

export function AdminPrefetchProvider({
  children,
  sessionReady,
}: {
  children: React.ReactNode;
  sessionReady: boolean;
}) {
  const prefetchTab = useCallback(
    (tab: string) => {
      if (!sessionReady) return;
      const opts = { credentials: 'include' as RequestCredentials };
      switch (tab) {
        case 'businesses':
          if (getAdminCached(ADMIN_CACHE_KEYS.BUSINESSES)) return;
          adminFetch('/api/admin/businesses', opts)
            .then((r) => r.json())
            .then((data) => {
              if (data?.success !== false)
                setAdminCache(ADMIN_CACHE_KEYS.BUSINESSES, data?.data ?? data);
            })
            .catch(() => {});
          break;
        case 'users':
          if (getAdminCached(ADMIN_CACHE_KEYS.USERS)) return;
          adminFetch(`/api/admin/users?limit=${LIST_LIMIT}`, opts)
            .then((r) => r.json())
            .then((data) => {
              if (data?.success !== false)
                setAdminCache(ADMIN_CACHE_KEYS.USERS, data?.data ?? data);
            })
            .catch(() => {});
          break;
        case 'bookings':
          if (getAdminCached(ADMIN_CACHE_KEYS.BOOKINGS)) return;
          adminFetch(`/api/admin/bookings?limit=${LIST_LIMIT}`, opts)
            .then((r) => r.json())
            .then((data) => {
              if (data?.success !== false)
                setAdminCache(ADMIN_CACHE_KEYS.BOOKINGS, data?.data ?? data);
            })
            .catch(() => {});
          break;
        case 'audit':
          if (getAdminCached(ADMIN_CACHE_KEYS.AUDIT)) return;
          adminFetch(`/api/admin/audit-logs?limit=${LIST_LIMIT}`, opts)
            .then((r) => r.json())
            .then((data) => {
              if (data?.success !== false)
                setAdminCache(ADMIN_CACHE_KEYS.AUDIT, data?.data ?? data);
            })
            .catch(() => {});
          break;
        case 'analytics': {
          const end = new Date();
          const start = new Date();
          start.setDate(start.getDate() - OVERVIEW_DAYS);
          const defaultStart = start.toISOString().split('T')[0];
          const defaultEnd = end.toISOString().split('T')[0];
          const key = getAdminAnalyticsCacheKey(defaultStart, defaultEnd);
          if (getAdminCached(key)) return;
          const params = new URLSearchParams({
            startDate: `${defaultStart}T00:00:00.000Z`,
            endDate: `${defaultEnd}T23:59:59.999Z`,
          });
          Promise.allSettled([
            adminFetch(`/api/admin/revenue-metrics?${params}`, opts).then((r) => r.json()),
            adminFetch(`/api/admin/booking-funnel?${params}`, opts).then((r) => r.json()),
            adminFetch(`/api/admin/business-health?${params}&limit=20`, opts).then((r) => r.json()),
            adminFetch('/api/admin/system-metrics', opts).then((r) => r.json()),
          ])
            .then(([rev, fun, health, sys]) => {
              setAdminCache(key, {
                revenue: rev.status === 'fulfilled' && rev.value?.success ? rev.value.data : null,
                funnel: fun.status === 'fulfilled' && fun.value?.success ? fun.value.data : null,
                health:
                  health.status === 'fulfilled' && health.value?.success ? health.value.data : null,
                system: sys.status === 'fulfilled' && sys.value?.success ? sys.value.data : null,
              });
            })
            .catch(() => {});
          break;
        }
        default:
          break;
      }
    },
    [sessionReady]
  );

  return (
    <AdminPrefetchContext.Provider value={{ prefetchTab }}>
      {children}
    </AdminPrefetchContext.Provider>
  );
}

export function useAdminPrefetch(): PrefetchContextValue {
  const ctx = useContext(AdminPrefetchContext);
  return ctx ?? { prefetchTab: () => {} };
}
