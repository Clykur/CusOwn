'use client';

import { useState, useEffect, useCallback, useRef, useMemo, Suspense, lazy } from 'react';
import dynamic from 'next/dynamic';
import { useRouter, useSearchParams } from 'next/navigation';
import { DashboardErrorBoundary } from '@/components/admin/dashboard-error-boundary';
import CloseIcon from '@/src/icons/close.svg';
import { AdminMetricCard } from '@/components/admin/admin-metric-card';
import { AdminSectionWrapper } from '@/components/admin/admin-section-wrapper';
import { useAdminSession } from '@/components/admin/admin-session-context';
import { AdminPrefetchProvider, useAdminPrefetch } from '@/components/admin/admin-prefetch-context';
import {
  getAdminCached,
  getAdminCachedStale,
  setAdminCache,
  invalidateAdminCache,
  ADMIN_CACHE_KEYS,
} from '@/components/admin/admin-cache';
import { adminFetch } from '@/lib/utils/admin-fetch.client';
import {
  AdminDashboardSkeleton,
  AdminAnalyticsSkeleton,
  OverviewSkeleton,
} from '@/components/ui/skeleton';
import FilterDropdown from '@/components/analytics/FilterDropdown';
import { ROUTES, getAdminDashboardUrl } from '@/lib/utils/navigation';
import { SUCCESS_MESSAGES } from '@/config/constants';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import { useAdminDashboardStore } from '@/lib/store/admin-dashboard-store';

const AdminBusinessesTab = lazy(() => import('@/components/admin/admin-businesses-tab'));
const AdminUsersTab = lazy(() => import('@/components/admin/admin-users-tab'));
const AdminBookingsTab = lazy(() => import('@/components/admin/admin-bookings-tab'));

const SuccessMetricsDashboard = dynamic(
  () => import('@/components/admin/success-metrics-dashboard'),
  { ssr: false, loading: () => <AdminAnalyticsSkeleton /> }
);
const AdminAnalyticsTab = dynamic(() => import('@/components/admin/admin-analytics-tab'), {
  ssr: false,
  loading: () => <AdminAnalyticsSkeleton />,
});
const AdminCronMonitorTab = dynamic(
  () => import('@/components/admin/admin-cron-monitor-tab').then((m) => m.AdminCronMonitorTab),
  { ssr: false, loading: () => <AdminAnalyticsSkeleton /> }
);
const AdminAuthManagementTab = dynamic(
  () =>
    import('@/components/admin/admin-auth-management-tab').then((m) => m.AdminAuthManagementTab),
  { ssr: false, loading: () => <AdminAnalyticsSkeleton /> }
);
const AdminStorageOverviewTab = dynamic(
  () =>
    import('@/components/admin/admin-storage-overview-tab').then((m) => m.AdminStorageOverviewTab),
  { ssr: false, loading: () => <AdminAnalyticsSkeleton /> }
);

const LazyLine = dynamic(
  () => import('@/components/admin/lazy-charts').then((m) => ({ default: m.Line })),
  { ssr: false }
);
const LazyBar = dynamic(
  () => import('@/components/admin/lazy-charts').then((m) => ({ default: m.Bar })),
  { ssr: false }
);

function PrefetchAnalyticsWhenReady({ adminConfirmed }: { adminConfirmed: boolean }) {
  const { prefetchTab } = useAdminPrefetch();
  useEffect(() => {
    if (adminConfirmed) prefetchTab('analytics');
  }, [adminConfirmed, prefetchTab]);
  return null;
}

interface PlatformMetrics {
  totalBusinesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  totalOwners: number;
  totalCustomers: number;
  totalBookings: number;
  confirmedBookings: number;
  rejectedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  bookingsToday: number;
  bookingsThisWeek: number;
  bookingsThisMonth: number;
  growthRate: {
    businesses: number;
    bookings: number;
    owners: number;
  };
}

interface BookingTrend {
  date: string;
  total: number;
  confirmed: number;
  rejected: number;
}

const OVERVIEW_DAYS = 30;
const LIST_LIMIT = 25;
const TABLE_PAGE_SIZE = 10;

const VALID_TABS = [
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
] as const;
type TabValue = (typeof VALID_TABS)[number];

function normalizeTab(tab: string | undefined): TabValue {
  return VALID_TABS.includes(tab as TabValue) ? (tab as TabValue) : 'overview';
}

function parsePageParam(value: string | null): number {
  const n = value ? parseInt(value, 10) : NaN;
  return Number.isFinite(n) && n >= 1 ? n : 1;
}

function AdminDashboardContentInner({ initialTab }: { initialTab: TabValue }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const activeTab = normalizeTab(searchParams?.get('tab') ?? undefined);
  const currentPage = parsePageParam(searchParams?.get('page') ?? null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('admin-tab-change', { detail: { tab: activeTab } }));
    }
  }, [activeTab]);

  const { session, ready, initialAdminConfirmed } = useAdminSession();
  const user = session?.user ?? null;
  const redirectToLoginRef = useRef(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [adminConfirmed, setAdminConfirmed] = useState(!!initialAdminConfirmed);
  const [usersToastMessage, setUsersToastMessage] = useState<string | null>(null);
  const dashboardStore = useAdminDashboardStore();
  const hasStoreData = dashboardStore.metrics !== null;

  const [overviewLoadSettled, setOverviewLoadSettled] = useState(hasStoreData);
  const [overviewRetryKey, setOverviewRetryKey] = useState(0);

  const [metrics, setMetrics] = useState<PlatformMetrics | null>(() => dashboardStore.metrics);
  const [trends, setTrends] = useState<BookingTrend[]>(() => dashboardStore.trends);
  const [revenueSnapshot, setRevenueSnapshot] = useState<{
    totalRevenue: number;
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
    paymentSuccessRate: number;
    failedPayments: number;
  } | null>(() => dashboardStore.revenueSnapshot as any);
  const [overviewExtras, setOverviewExtras] = useState<{
    failedBookingsLast24h: number;
    cronRunsLast24h: number;
    systemHealth: {
      status: string;
      cronExpireBookingsOk: boolean;
      cronExpireBookingsLastRun: string | null;
    };
  } | null>(() => dashboardStore.overviewExtras as any);

  useEffect(() => {
    if (metrics) dashboardStore.setMetrics(metrics);
  }, [metrics]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (trends.length > 0) dashboardStore.setTrends(trends);
  }, [trends]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (revenueSnapshot) dashboardStore.setRevenueSnapshot(revenueSnapshot as any);
  }, [revenueSnapshot]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (overviewExtras) dashboardStore.setOverviewExtras(overviewExtras as any);
  }, [overviewExtras]); // eslint-disable-line react-hooks/exhaustive-deps

  const toastParam = searchParams?.get('toast');
  useEffect(() => {
    if (toastParam === 'user_deleted' && activeTab === 'users') {
      setUsersToastMessage(SUCCESS_MESSAGES.USER_DELETED);
      router.replace(getAdminDashboardUrl('users'));
    }
  }, [toastParam, activeTab, router]);

  useEffect(() => {
    if (!usersToastMessage) return;
    const t = setTimeout(() => setUsersToastMessage(null), 5000);
    return () => clearTimeout(t);
  }, [usersToastMessage]);

  // Non-blocking admin check in background (auth via cookies). Timeout so we don't spin forever.
  useEffect(() => {
    if (!ready) return;
    const ac = new AbortController();
    const timeoutId = setTimeout(() => ac.abort(), 10000);

    fetch('/api/admin/check-status', {
      credentials: 'include',
      signal: ac.signal,
    })
      .then((res) => res.json())
      .then(
        (statusData: {
          success?: boolean;
          data?: {
            is_admin?: boolean;
            user_type?: string;
            profile_exists?: boolean;
          };
          error?: string;
        }) => {
          if (ac.signal.aborted) return;
          if (!statusData.success) {
            setAuthError(statusData.error || 'Failed to check admin status');
            return;
          }
          const { is_admin, user_type, profile_exists } = statusData.data ?? {};
          if (is_admin) {
            setAdminConfirmed(true);
            return;
          }
          if (!profile_exists) {
            setAuthError(
              `Your profile doesn't exist yet. User type: ${user_type || 'none'}. Please contact support or use the migration query to set admin status.`
            );
          } else {
            setAuthError(
              `You don't have admin access. Current user type: ${user_type}. Please run the migration query to set your account as admin.`
            );
          }
        }
      )
      .catch((err) => {
        if (ac.signal.aborted) {
          setAuthError('Admin check timed out. Please refresh the page.');
          return;
        }
        setAuthError(
          err?.name === 'AbortError'
            ? 'Admin check timed out. Please refresh.'
            : 'Failed to check admin status'
        );
      })
      .finally(() => clearTimeout(timeoutId));

    return () => {
      clearTimeout(timeoutId);
      ac.abort();
    };
  }, [ready]);

  // Prefetch only list endpoints that are not already cached (auth via cookies).
  const prefetchListData = useCallback(() => {
    if (!adminConfirmed) return;
    const opts: RequestInit = { credentials: 'include' };
    const urls = [
      `/api/admin/users?limit=${LIST_LIMIT}`,
      '/api/admin/businesses',
      `/api/admin/bookings?limit=${LIST_LIMIT}`,
      `/api/admin/audit-logs?limit=${AUDIT_LOGS_FETCH_LIMIT}`,
    ];
    const keys = [
      ADMIN_CACHE_KEYS.USERS,
      ADMIN_CACHE_KEYS.BUSINESSES,
      ADMIN_CACHE_KEYS.BOOKINGS,
      ADMIN_CACHE_KEYS.AUDIT,
    ];
    keys.forEach((key, i) => {
      if (getAdminCached(key)) return;
      adminFetch(urls[i], opts)
        .then((r) => r.json())
        .then((data) => {
          if (data?.success !== false) setAdminCache(key, data?.data ?? data);
        })
        .catch(() => {});
    });
  }, [adminConfirmed]);

  // Overview: only after admin confirmed. Auth via cookies.
  useEffect(() => {
    if (!ready || !adminConfirmed) return;
    const opts: RequestInit = { credentials: 'include' };

    const freshOverview = getAdminCached<{
      metrics: PlatformMetrics;
      trends: BookingTrend[];
      revenueSnapshot: {
        totalRevenue: number;
        revenueToday: number;
        revenueWeek: number;
        revenueMonth: number;
        paymentSuccessRate: number;
        failedPayments: number;
      } | null;
    }>(ADMIN_CACHE_KEYS.OVERVIEW);
    if (freshOverview?.metrics) {
      setMetrics(freshOverview.metrics);
      if (freshOverview.trends?.length) setTrends(freshOverview.trends);
      if (freshOverview.revenueSnapshot) setRevenueSnapshot(freshOverview.revenueSnapshot);
      setOverviewLoadSettled(true);
      prefetchListData();
      return;
    }

    prefetchListData();
    const staleEntry = getAdminCachedStale<{
      metrics: PlatformMetrics;
      trends: BookingTrend[];
      revenueSnapshot: {
        totalRevenue: number;
        revenueToday: number;
        revenueWeek: number;
        revenueMonth: number;
        paymentSuccessRate: number;
        failedPayments: number;
      } | null;
    }>(ADMIN_CACHE_KEYS.OVERVIEW);
    if (staleEntry?.data) {
      if (staleEntry.data.metrics) setMetrics(staleEntry.data.metrics);
      if (staleEntry.data.trends?.length) setTrends(staleEntry.data.trends);
      if (staleEntry.data.revenueSnapshot) setRevenueSnapshot(staleEntry.data.revenueSnapshot);
    }

    adminFetch(`/api/admin/overview?aggregated=true&days=${OVERVIEW_DAYS}`, opts)
      .then((r) => r.json())
      .then((result) => {
        setOverviewLoadSettled(true);
        if (!result?.success || !result?.data) return;

        const data = result.data as {
          metrics?: PlatformMetrics;
          trends?: BookingTrend[];
          revenueSnapshot?: {
            totalRevenue: number;
            revenueToday: number;
            revenueWeek: number;
            revenueMonth: number;
            paymentSuccessRate: number;
            failedPayments: number;
          };
          overviewExtras?: {
            failedBookingsLast24h: number;
            cronRunsLast24h: number;
            systemHealth: {
              status: string;
              cronExpireBookingsOk: boolean;
              cronExpireBookingsLastRun: string | null;
            };
          };
        };

        if (data.metrics) {
          setMetrics(data.metrics);
        }
        if (data.trends?.length) {
          setTrends(data.trends);
        }
        if (data.revenueSnapshot) {
          setRevenueSnapshot(data.revenueSnapshot);
        }
        if (data.overviewExtras?.systemHealth) {
          setOverviewExtras({
            failedBookingsLast24h: data.overviewExtras.failedBookingsLast24h ?? 0,
            cronRunsLast24h: data.overviewExtras.cronRunsLast24h ?? 0,
            systemHealth: {
              status: data.overviewExtras.systemHealth.status ?? 'unknown',
              cronExpireBookingsOk: data.overviewExtras.systemHealth.cronExpireBookingsOk ?? false,
              cronExpireBookingsLastRun:
                data.overviewExtras.systemHealth.cronExpireBookingsLastRun ?? null,
            },
          });
        }

        setAdminCache(ADMIN_CACHE_KEYS.OVERVIEW, {
          metrics: data.metrics ?? null,
          trends: data.trends ?? [],
          revenueSnapshot: data.revenueSnapshot ?? null,
        });
      })
      .catch(() => {
        setOverviewLoadSettled(true);
      });
  }, [ready, adminConfirmed, prefetchListData, overviewRetryKey]);

  const bookingTrendsChart = useMemo(
    () => ({
      labels: trends.map((t) => {
        const date = new Date(t.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }),
      datasets: [
        {
          label: 'Total Bookings',
          data: trends.map((t) => t.total),
          backgroundColor: 'rgb(0, 0, 0)',
          borderColor: 'rgb(0, 0, 0)',
          borderWidth: 2,
        },
        {
          label: 'Confirmed',
          data: trends.map((t) => t.confirmed),
          backgroundColor: 'rgb(64, 64, 64)',
          borderColor: 'rgb(64, 64, 64)',
          borderWidth: 2,
        },
        {
          label: 'Rejected',
          data: trends.map((t) => t.rejected),
          backgroundColor: 'rgb(128, 128, 128)',
          borderColor: 'rgb(128, 128, 128)',
          borderWidth: 2,
        },
      ],
    }),
    [trends]
  );

  const bookingStatusChart = useMemo(
    () =>
      metrics
        ? {
            labels: ['Confirmed', 'Pending', 'Rejected', 'Cancelled'],
            datasets: [
              {
                label: 'Number of Bookings',
                data: [
                  metrics.confirmedBookings,
                  metrics.pendingBookings,
                  metrics.rejectedBookings,
                  metrics.cancelledBookings,
                ],
                backgroundColor: [
                  'rgb(0, 0, 0)',
                  'rgb(64, 64, 64)',
                  'rgb(128, 128, 128)',
                  'rgb(192, 192, 192)',
                ],
                borderColor: 'rgb(0, 0, 0)',
                borderWidth: 2,
              },
            ],
          }
        : null,
    [metrics]
  );

  const growthChart = useMemo(
    () =>
      metrics
        ? {
            labels: ['Businesses', 'Bookings', 'Owners'],
            datasets: [
              {
                label: 'Growth Rate (%)',
                data: [
                  metrics.growthRate.businesses,
                  metrics.growthRate.bookings,
                  metrics.growthRate.owners,
                ],
                borderColor: 'rgb(0, 0, 0)',
                backgroundColor: 'rgba(0, 0, 0, 0.1)',
                borderWidth: 3,
                tension: 0.4,
                fill: true,
                pointRadius: 8,
                pointBackgroundColor: ['rgb(0, 0, 0)', 'rgb(64, 64, 64)', 'rgb(128, 128, 128)'],
                pointBorderColor: 'rgb(0, 0, 0)',
                pointBorderWidth: 2,
              },
            ],
          }
        : null,
    [metrics]
  );

  if (!ready) {
    const isAnalyticsTab = activeTab === 'analytics';
    return (
      <div className="min-h-screen bg-white flex">
        <div className="flex-1 w-full flex flex-col min-h-0">
          <div className="w-full max-w-full px-0 py-8 flex-1 flex flex-col min-h-0">
            {isAnalyticsTab ? <AdminAnalyticsSkeleton /> : <OverviewSkeleton />}
          </div>
        </div>
      </div>
    );
  }

  if (!session) {
    if (!redirectToLoginRef.current) {
      redirectToLoginRef.current = true;
      router.replace(ROUTES.AUTH_LOGIN(ROUTES.ADMIN_DASHBOARD));
    }
    return (
      <div className="min-h-screen bg-white flex">
        <div className="flex-1 w-full flex items-center justify-center">
          <OverviewSkeleton />
        </div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="min-h-screen bg-white flex">
        <div className="flex-1 w-full flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-4">{authError}</p>

            {authError.includes('migration') && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4 text-left">
                <p className="text-sm text-yellow-800 mb-2">
                  <strong>To fix this:</strong>
                </p>
                <ol className="text-sm text-yellow-700 list-decimal list-inside space-y-1">
                  <li>Go to Supabase Dashboard → SQL Editor</li>
                  <li>
                    Run the migration query from{' '}
                    <code className="bg-yellow-100 px-1 rounded">
                      database/migration_set_admin_quick.sql
                    </code>
                  </li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => router.push(ROUTES.HOME)}
                className="flex-1 px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
              >
                Go to Home
              </button>
              {(user?.email === 'chinnuk0521@gmail.com' ||
                user?.email === 'karthiknaramala9949@gmail.com') && (
                <button
                  onClick={async () => {
                    try {
                      const csrfToken = await getCSRFToken();
                      const headers: Record<string, string> = {
                        'Content-Type': 'application/json',
                      };
                      if (csrfToken) {
                        headers['x-csrf-token'] = csrfToken;
                      }
                      const res = await fetch('/api/admin/check-status', {
                        method: 'POST',
                        headers,
                        credentials: 'include',
                        body: JSON.stringify({ email: user.email }),
                      });
                      const data = await res.json();
                      if (data.success) {
                        setAuthError(null);
                        setAdminConfirmed(true);
                      } else {
                        alert('Failed to set admin status: ' + (data.error || 'Unknown error'));
                      }
                    } catch (err) {
                      alert('Error: ' + (err instanceof Error ? err.message : 'Unknown error'));
                    }
                  }}
                  className="flex-1 px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors"
                >
                  Try Set Admin
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (ready && session && !adminConfirmed && !authError) {
    return (
      <div className="min-h-screen bg-white flex">
        <div className="flex-1 w-full flex items-center justify-center">
          <OverviewSkeleton />
        </div>
      </div>
    );
  }

  return (
    <AdminPrefetchProvider sessionReady={!!(ready && session)}>
      <PrefetchAnalyticsWhenReady adminConfirmed={adminConfirmed} />
      <div className="min-h-screen bg-white flex">
        <div className="flex-1 w-full">
          <DashboardErrorBoundary>
            <div className="w-full max-w-full">
              {activeTab === 'overview' && !metrics && !overviewLoadSettled && <OverviewSkeleton />}
              {activeTab === 'overview' && !metrics && overviewLoadSettled && (
                <div className="space-y-8">
                  <AdminSectionWrapper
                    title="Overview"
                    subtitle="Platform-wide metrics at a glance"
                  >
                    <div className="rounded-xl border border-amber-200 bg-amber-50/50 py-12 text-center">
                      <p className="text-sm font-medium text-amber-800">
                        Could not load metrics. The request may have failed or timed out.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          invalidateAdminCache(ADMIN_CACHE_KEYS.OVERVIEW);
                          setOverviewLoadSettled(false);
                          setOverviewRetryKey((k) => k + 1);
                        }}
                        className="mt-4 rounded-lg border border-amber-300 bg-white px-4 py-2 text-sm font-medium text-amber-800 shadow-sm hover:bg-amber-50"
                      >
                        Retry
                      </button>
                    </div>
                  </AdminSectionWrapper>
                </div>
              )}
              {activeTab === 'overview' && metrics && (
                <div className="flex flex-col gap-8">
                  <div>
                    <h1 className="text-xl font-semibold text-slate-900 tracking-tight">
                      Overview
                    </h1>
                    <p className="mt-0.5 text-sm text-slate-500">
                      Platform-wide metrics at a glance
                    </p>
                  </div>
                  <AdminSectionWrapper
                    title="Core metrics"
                    subtitle="Businesses, bookings and owners"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <AdminMetricCard
                        label="Total businesses"
                        value={metrics.totalBusinesses}
                        secondary={`${metrics.growthRate.businesses > 0 ? '+' : ''}${metrics.growthRate.businesses.toFixed(1)}% growth`}
                        secondaryVariant={
                          metrics.growthRate.businesses > 0
                            ? 'positive'
                            : metrics.growthRate.businesses < 0
                              ? 'negative'
                              : 'neutral'
                        }
                      />
                      <AdminMetricCard
                        label="Active businesses"
                        value={metrics.activeBusinesses}
                        secondary={`${metrics.suspendedBusinesses} suspended`}
                      />
                      <AdminMetricCard
                        label="Total bookings"
                        value={metrics.totalBookings}
                        secondary={`${metrics.growthRate.bookings > 0 ? '+' : ''}${metrics.growthRate.bookings.toFixed(1)}% growth`}
                        secondaryVariant={
                          metrics.growthRate.bookings > 0
                            ? 'positive'
                            : metrics.growthRate.bookings < 0
                              ? 'negative'
                              : 'neutral'
                        }
                      />
                      <AdminMetricCard
                        label="Total owners"
                        value={metrics.totalOwners}
                        secondary={`${metrics.growthRate.owners > 0 ? '+' : ''}${metrics.growthRate.owners.toFixed(1)}% growth`}
                        secondaryVariant={
                          metrics.growthRate.owners > 0
                            ? 'positive'
                            : metrics.growthRate.owners < 0
                              ? 'negative'
                              : 'neutral'
                        }
                      />
                    </div>
                  </AdminSectionWrapper>

                  <AdminSectionWrapper
                    title="Booking volume"
                    subtitle="Today, this week, this month and customers"
                  >
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      <AdminMetricCard label="Bookings today" value={metrics.bookingsToday} />
                      <AdminMetricCard label="This week" value={metrics.bookingsThisWeek} />
                      <AdminMetricCard label="This month" value={metrics.bookingsThisMonth} />
                      <AdminMetricCard label="Total customers" value={metrics.totalCustomers} />
                    </div>
                  </AdminSectionWrapper>

                  {overviewExtras && (
                    <AdminSectionWrapper
                      title="System (last 24h)"
                      subtitle="Failed bookings, cron runs, health"
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        <AdminMetricCard
                          label="Failed bookings (24h)"
                          value={overviewExtras.failedBookingsLast24h}
                        />
                        <AdminMetricCard
                          label="Cron runs (24h)"
                          value={overviewExtras.cronRunsLast24h}
                        />
                        <AdminMetricCard
                          label="System health"
                          value={overviewExtras.systemHealth.status}
                        />
                        <AdminMetricCard
                          label="Cron expire OK"
                          value={overviewExtras.systemHealth.cronExpireBookingsOk ? 'Yes' : 'No'}
                        />
                      </div>
                      {overviewExtras.systemHealth.cronExpireBookingsLastRun && (
                        <p className="mt-2 text-xs text-slate-500">
                          Last cron run:{' '}
                          {new Date(
                            overviewExtras.systemHealth.cronExpireBookingsLastRun
                          ).toLocaleString()}
                        </p>
                      )}
                    </AdminSectionWrapper>
                  )}

                  {revenueSnapshot && (
                    <AdminSectionWrapper
                      title="Revenue (last 30 days)"
                      subtitle="Totals and payment success"
                    >
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
                        <AdminMetricCard
                          label="Total revenue"
                          value={`₹${revenueSnapshot.totalRevenue.toFixed(2)}`}
                        />
                        <AdminMetricCard
                          label="Today"
                          value={`₹${revenueSnapshot.revenueToday.toFixed(2)}`}
                        />
                        <AdminMetricCard
                          label="This week"
                          value={`₹${revenueSnapshot.revenueWeek.toFixed(2)}`}
                        />
                        <AdminMetricCard
                          label="This month"
                          value={`₹${revenueSnapshot.revenueMonth.toFixed(2)}`}
                        />
                        <AdminMetricCard
                          label="Payment success %"
                          value={`${revenueSnapshot.paymentSuccessRate.toFixed(2)}%`}
                        />
                        <AdminMetricCard
                          label="Failed payments"
                          value={revenueSnapshot.failedPayments}
                        />
                      </div>
                    </AdminSectionWrapper>
                  )}

                  <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
                    <AdminSectionWrapper
                      title="Booking trends (30 days)"
                      subtitle="Daily totals and status breakdown"
                    >
                      {trends.length > 0 ? (
                        <LazyBar
                          data={bookingTrendsChart}
                          options={{
                            responsive: true,
                            plugins: {
                              legend: { position: 'top' as const },
                              title: { display: false },
                            },
                            scales: { y: { beginAtZero: true } },
                          }}
                        />
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
                          <p className="text-sm font-medium text-slate-500">No data available</p>
                        </div>
                      )}
                    </AdminSectionWrapper>

                    <AdminSectionWrapper
                      title="Booking status distribution"
                      subtitle="Confirmed, pending, rejected, cancelled"
                    >
                      {bookingStatusChart ? (
                        <LazyBar
                          data={bookingStatusChart}
                          options={{
                            responsive: true,
                            plugins: { legend: { position: 'top' as const } },
                            scales: { y: { beginAtZero: true } },
                          }}
                        />
                      ) : (
                        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
                          <p className="text-sm font-medium text-slate-500">No data available</p>
                        </div>
                      )}
                    </AdminSectionWrapper>
                  </div>

                  <AdminSectionWrapper title="Growth trends" subtitle="Growth rate by category">
                    {growthChart ? (
                      <LazyLine
                        data={growthChart}
                        options={{
                          responsive: true,
                          plugins: {
                            legend: { position: 'top' as const },
                            title: { display: false },
                          },
                          scales: { y: { beginAtZero: true } },
                        }}
                      />
                    ) : (
                      <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
                        <p className="text-sm font-medium text-slate-500">No data available</p>
                      </div>
                    )}
                  </AdminSectionWrapper>
                </div>
              )}

              {activeTab === 'businesses' && (
                <Suspense fallback={<OverviewSkeleton />}>
                  <AdminBusinessesTab
                    page={currentPage}
                    onPageChange={(p) => router.replace(getAdminDashboardUrl('businesses', p))}
                  />
                </Suspense>
              )}

              {activeTab === 'users' && (
                <div className="space-y-4">
                  {usersToastMessage && (
                    <div
                      className="flex items-center justify-between gap-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800"
                      role="status"
                      aria-live="polite"
                    >
                      <span>{usersToastMessage}</span>
                      <button
                        type="button"
                        onClick={() => setUsersToastMessage(null)}
                        className="shrink-0 rounded p-1 text-emerald-700 hover:bg-emerald-100 transition-colors"
                        aria-label="Dismiss"
                      >
                        <CloseIcon className="h-4 w-4" aria-hidden="true" />
                      </button>
                    </div>
                  )}
                  <Suspense fallback={<OverviewSkeleton />}>
                    <AdminUsersTab
                      page={currentPage}
                      onPageChange={(p) => router.replace(getAdminDashboardUrl('users', p))}
                    />
                  </Suspense>
                </div>
              )}

              {activeTab === 'bookings' && (
                <Suspense fallback={<OverviewSkeleton />}>
                  <AdminBookingsTab
                    page={currentPage}
                    onPageChange={(p) => router.replace(getAdminDashboardUrl('bookings', p))}
                  />
                </Suspense>
              )}

              {activeTab === 'audit' && (
                <AuditLogsTab
                  page={currentPage}
                  onPageChange={(p) => router.replace(getAdminDashboardUrl('audit', p))}
                />
              )}

              {activeTab === 'cron-monitor' && <AdminCronMonitorTab />}
              {activeTab === 'auth-management' && <AdminAuthManagementTab />}
              {activeTab === 'storage' && <AdminStorageOverviewTab />}

              {activeTab === 'success-metrics' && <SuccessMetricsDashboard />}

              {activeTab === 'analytics' && <AdminAnalyticsTab />}
            </div>
          </DashboardErrorBoundary>
        </div>
      </div>
    </AdminPrefetchProvider>
  );
}

export default function AdminDashboardClient({ initialTab }: { initialTab: string | undefined }) {
  const tab = normalizeTab(initialTab);
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <AdminDashboardContentInner initialTab={tab} />
    </Suspense>
  );
}

interface ListTabPageProps {
  page?: number;
  onPageChange?: (p: number) => void;
}

const AUDIT_SEVERITY_OPTIONS = [
  { value: '', label: 'All severities' },
  { value: 'info', label: 'Info' },
  { value: 'warning', label: 'Warning' },
  { value: 'critical', label: 'Critical' },
];
const AUDIT_STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'success', label: 'Success' },
  { value: 'failed', label: 'Failed' },
];
const AUDIT_ACTION_GROUP_OPTIONS = [
  { value: '', label: 'All groups' },
  { value: 'booking', label: 'Booking' },
  { value: 'business', label: 'Business' },
  { value: 'user', label: 'User' },
  { value: 'payment', label: 'Payment' },
  { value: 'system', label: 'System' },
  { value: 'slot', label: 'Slot' },
];
const AUDIT_ACTOR_ROLE_OPTIONS = [
  { value: '', label: 'All actors' },
  { value: 'admin', label: 'Admin' },
  { value: 'owner', label: 'Owner' },
  { value: 'customer', label: 'Customer' },
  { value: 'both', label: 'Owner & Customer' },
  { value: 'system', label: 'System' },
];

const AUDIT_LOGS_FETCH_LIMIT = 50;

function AuditLogsTab({ page: controlledPage, onPageChange }: ListTabPageProps = {}) {
  const { session, ready } = useAdminSession();
  const [logs, setLogs] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSeverity, setFilterSeverity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterActorRole, setFilterActorRole] = useState('');
  const [filterActionGroup, setFilterActionGroup] = useState('');
  const [internalPage, setInternalPage] = useState(1);
  const page = controlledPage ?? internalPage;
  const setPage = onPageChange
    ? (p: number | ((prev: number) => number)) =>
        onPageChange(typeof p === 'function' ? p(page) : p)
    : setInternalPage;

  const prevSearchRef = useRef(searchQuery);
  useEffect(() => {
    if (prevSearchRef.current !== searchQuery) {
      prevSearchRef.current = searchQuery;
      if (onPageChange) onPageChange(1);
      else setInternalPage(1);
    }
  }, [searchQuery, onPageChange]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const isDev =
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

  const hasFilters =
    filterSeverity !== '' ||
    filterStatus !== '' ||
    filterActorRole !== '' ||
    filterActionGroup !== '';

  const severityOptions = useMemo(
    () => AUDIT_SEVERITY_OPTIONS.map((o) => ({ ...o, checked: filterSeverity === o.value })),
    [filterSeverity]
  );
  const statusOptions = useMemo(
    () => AUDIT_STATUS_OPTIONS.map((o) => ({ ...o, checked: filterStatus === o.value })),
    [filterStatus]
  );
  const actionGroupOptions = useMemo(
    () => AUDIT_ACTION_GROUP_OPTIONS.map((o) => ({ ...o, checked: filterActionGroup === o.value })),
    [filterActionGroup]
  );
  const actorRoleOptions = useMemo(
    () => AUDIT_ACTOR_ROLE_OPTIONS.map((o) => ({ ...o, checked: filterActorRole === o.value })),
    [filterActorRole]
  );

  useEffect(() => {
    setError(null);
    if (!hasFilters) {
      const cached = getAdminCached<any[]>(ADMIN_CACHE_KEYS.AUDIT);
      if (cached && Array.isArray(cached)) {
        setLogs(cached);
        setLoading(false);
        return;
      }
      const stale = getAdminCachedStale<any[]>(ADMIN_CACHE_KEYS.AUDIT);
      if (stale?.data && Array.isArray(stale.data)) {
        setLogs(stale.data);
        setLoading(false);
        if (!ready || !session) return;
        adminFetch(`/api/admin/audit-logs?limit=${AUDIT_LOGS_FETCH_LIMIT}`, {
          credentials: 'include',
        })
          .then((r) => r.json())
          .then((data) => {
            if (data.success) {
              const list = Array.isArray(data.data) ? data.data : [];
              setLogs(list);
              setAdminCache(ADMIN_CACHE_KEYS.AUDIT, list);
            }
          })
          .catch(() => {});
        return;
      }
    }
    if (!ready || !session) {
      setError('Session expired. Please log in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const ac = new AbortController();
    const params = new URLSearchParams({
      limit: String(AUDIT_LOGS_FETCH_LIMIT),
    });
    if (filterSeverity) params.set('severity', filterSeverity);
    if (filterStatus) params.set('status', filterStatus);
    if (filterActorRole) params.set('actor_role', filterActorRole);
    if (filterActionGroup) params.set('action_group', filterActionGroup);
    const url = `/api/admin/audit-logs?${params.toString()}`;
    adminFetch(url, { credentials: 'include', signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        if (ac.signal.aborted) return;
        if (data.success) {
          const list = Array.isArray(data.data) ? data.data : [];
          setLogs(list);
          if (!hasFilters) setAdminCache(ADMIN_CACHE_KEYS.AUDIT, list);
        } else {
          setError(data.error || 'Failed to load audit logs');
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [
    ready,
    session,
    filterSeverity,
    filterStatus,
    filterActorRole,
    filterActionGroup,
    hasFilters,
  ]);

  const humanAction = (action: string) =>
    action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const formatAuditDescription = (log: any): string => {
    if (log.description && String(log.description).trim()) {
      const d = String(log.description).trim();
      return d.endsWith('.') ? d : d.charAt(0).toUpperCase() + d.slice(1) + '.';
    }
    const actionType = log.action_type || '';
    const oldData = log.old_data || {};
    const newData = log.new_data || {};

    // Business actions
    if (actionType === 'business_updated' || actionType === 'business_suspended') {
      const changes: string[] = [];
      if (
        oldData.suspended !== undefined &&
        newData.suspended !== undefined &&
        oldData.suspended !== newData.suspended
      ) {
        changes.push(
          newData.suspended ? 'Business was suspended' : 'Business suspension was removed'
        );
        if (newData.suspended && newData.suspended_reason) {
          changes.push(`Reason: ${newData.suspended_reason}`);
        }
      }
      const fields: Record<string, string> = {
        salon_name: 'Business name',
        owner_name: 'Owner name',
        whatsapp_number: 'WhatsApp number',
        opening_time: 'Opening time',
        closing_time: 'Closing time',
        slot_duration: 'Slot duration',
        address: 'Address',
        location: 'Location',
      };
      for (const [key, label] of Object.entries(fields)) {
        if (
          oldData[key] !== undefined &&
          newData[key] !== undefined &&
          oldData[key] !== newData[key]
        ) {
          const oldVal = oldData[key] === null ? 'Not set' : String(oldData[key]);
          const newVal = newData[key] === null ? 'Not set' : String(newData[key]);
          changes.push(`${label} changed from "${oldVal}" to "${newVal}"`);
        }
      }
      if (changes.length > 0) return changes.join('. ');
      return 'Business details were updated.';
    }

    if (actionType === 'business_created') {
      return `New business "${newData.salon_name || 'Unknown'}" was created.`;
    }
    if (actionType === 'business_deleted') {
      return `Business "${oldData.salon_name || 'Unknown'}" was deleted.`;
    }

    // User actions
    if (actionType === 'user_updated') {
      const changes: string[] = [];
      if (oldData.user_type !== newData.user_type) {
        changes.push(
          `User type changed from ${String(oldData.user_type)} to ${String(newData.user_type)}.`
        );
      }
      if (oldData.full_name !== newData.full_name) {
        changes.push(
          `Name changed from "${oldData.full_name || 'Not set'}" to "${newData.full_name || 'Not set'}".`
        );
      }
      if (changes.length > 0) return changes.join(' ');
      return 'User details were updated.';
    }
    if (actionType === 'user_created') {
      return `New user "${newData.full_name || newData.email || 'Unknown'}" was created.`;
    }
    if (actionType === 'user_deleted') {
      return `User "${oldData.full_name || oldData.email || 'Unknown'}" was deleted.`;
    }

    // Booking actions
    if (actionType === 'booking_updated') {
      if (oldData.status !== newData.status) {
        return `Booking status changed from ${String(oldData.status)} to ${String(newData.status)}.`;
      }
      return 'Booking details were updated.';
    }
    if (actionType === 'booking_cancelled') {
      return 'Booking was cancelled.';
    }
    if (
      actionType === 'booking_confirmed' ||
      actionType === 'booking_rejected' ||
      actionType === 'booking_expired'
    ) {
      return `Booking was ${actionType.replace('booking_', '')}.`;
    }

    return humanAction(actionType) + ' performed.';
  };

  const actorLabel = (log: any): string => {
    const role = log.actor_role && String(log.actor_role).trim();
    if (role) {
      const r = role.toLowerCase();
      if (r === 'admin') return 'Admin';
      if (r === 'owner') return 'Owner';
      if (r === 'customer') return 'Customer';
      if (r === 'both') return 'Owner & Customer';
      return role.charAt(0).toUpperCase() + role.slice(1);
    }
    if (log.admin_user_id) return '—';
    return 'System';
  };

  const severityBadge = (severity: string) => {
    const s = (severity || 'info').toLowerCase();
    if (s === 'critical')
      return (
        <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
          Critical
        </span>
      );
    if (s === 'warning')
      return (
        <span className="inline-flex items-center rounded-md border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700">
          Warning
        </span>
      );
    return (
      <span className="inline-flex items-center rounded-md border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-xs font-medium text-slate-600">
        Info
      </span>
    );
  };

  const statusBadge = (status: string) => {
    const s = (status || 'success').toLowerCase();
    if (s === 'failed')
      return (
        <span className="inline-flex items-center rounded-md border border-red-200 bg-red-50 px-2.5 py-0.5 text-xs font-medium text-red-700">
          Failed
        </span>
      );
    return (
      <span className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
        Success
      </span>
    );
  };

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Audit logs</h2>
          <p className="text-sm text-slate-500 mt-0.5">Recent platform activity and changes</p>
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="rounded-xl border border-red-200 bg-red-50/50 py-12 text-center">
            <p className="text-sm font-medium text-red-800">{error}</p>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Audit logs</h2>
        <p className="text-sm text-slate-500 mt-0.5">Recent platform activity and changes</p>
      </div>

      {isDev && selectedLog && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 shadow-sm">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-lg font-semibold text-amber-900">Debug information (dev only)</h3>
            <button
              onClick={() => setSelectedLog(null)}
              className="text-amber-700 hover:text-amber-900 text-sm font-medium"
            >
              Close
            </button>
          </div>
          <div className="space-y-4">
            <div>
              <h4 className="font-semibold text-amber-900 mb-2 text-sm">Raw data</h4>
              <pre className="bg-white p-4 rounded-xl border border-amber-200 overflow-auto text-xs text-slate-700">
                {JSON.stringify(selectedLog, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="font-semibold text-amber-900 mb-2 text-sm">Old data</h4>
              <pre className="bg-white p-4 rounded-xl border border-amber-200 overflow-auto text-xs text-slate-700">
                {JSON.stringify(selectedLog.old_data, null, 2)}
              </pre>
            </div>
            <div>
              <h4 className="font-semibold text-amber-900 mb-2 text-sm">New data</h4>
              <pre className="bg-white p-4 rounded-xl border border-amber-200 overflow-auto text-xs text-slate-700">
                {JSON.stringify(selectedLog.new_data, null, 2)}
              </pre>
            </div>
          </div>
        </section>
      )}

      <section className="min-w-0 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Activity log</h3>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-[160px]">
              <FilterDropdown
                label="Severity"
                options={severityOptions}
                onToggle={(value, checked) => {
                  if (checked) {
                    setFilterSeverity(value);
                    setPage(1);
                  }
                }}
              />
            </div>
            <div className="w-[160px]">
              <FilterDropdown
                label="Status"
                options={statusOptions}
                onToggle={(value, checked) => {
                  if (checked) {
                    setFilterStatus(value);
                    setPage(1);
                  }
                }}
              />
            </div>
            <div className="w-[160px]">
              <FilterDropdown
                label="Action group"
                options={actionGroupOptions}
                onToggle={(value, checked) => {
                  if (checked) {
                    setFilterActionGroup(value);
                    setPage(1);
                  }
                }}
              />
            </div>
            <div className="w-[160px]">
              <FilterDropdown
                label="Actor role"
                options={actorRoleOptions}
                onToggle={(value, checked) => {
                  if (checked) {
                    setFilterActorRole(value);
                    setPage(1);
                  }
                }}
              />
            </div>
            {(logs.length > 0 || loading) && (
              <input
                type="search"
                placeholder="Search audit logs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
                aria-label="Search audit logs"
              />
            )}
          </div>
        </div>
        {logs.length > 0 || loading ? (
          <div className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full max-w-full table-fixed border-collapse">
                <colgroup>
                  <col style={{ width: '14%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '16%' }} />
                  <col style={{ width: '10%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: '8%' }} />
                  <col style={{ width: isDev ? '28%' : '36%' }} />
                  {isDev && <col style={{ width: '8%' }} />}
                </colgroup>
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/80">
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Timestamp
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Actor
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Action
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Entity
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Severity
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Status
                    </th>
                    <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                      Description
                    </th>
                    {isDev && (
                      <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Debug
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {loading && logs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={isDev ? 8 : 7}
                        className="px-4 py-16 text-center text-sm text-slate-500"
                      >
                        <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-slate-300 border-t-slate-600" />
                        <p className="mt-3 font-medium">Loading audit logs...</p>
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const q = searchQuery.trim().toLowerCase();
                      const filtered = q
                        ? logs.filter((log) => {
                            const desc = formatAuditDescription(log);
                            return (
                              (log.action_type || '').toLowerCase().includes(q) ||
                              (log.entity_type || '').toLowerCase().includes(q) ||
                              (log.entity_id || '').toLowerCase().includes(q) ||
                              (log.actor_role || '').toLowerCase().includes(q) ||
                              desc.toLowerCase().includes(q)
                            );
                          })
                        : logs;
                      const start = (page - 1) * TABLE_PAGE_SIZE;
                      const paginated = filtered.slice(start, start + TABLE_PAGE_SIZE);
                      return paginated.map((log, idx) => (
                        <tr
                          key={log.id}
                          className={`border-b border-slate-100 transition-colors hover:bg-slate-50/70 ${
                            idx % 2 === 1 ? 'bg-slate-50/30' : 'bg-white'
                          }`}
                        >
                          <td className="px-4 py-3.5 align-top">
                            <span className="font-mono text-sm tabular-nums text-slate-600">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 align-top text-sm font-medium text-slate-700">
                            {actorLabel(log)}
                          </td>
                          <td className="px-4 py-3.5 align-top">
                            <span className="inline-block break-words rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-sm font-medium text-slate-700">
                              {log.action_type?.replace(/_/g, ' ')}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 align-top text-sm font-medium text-slate-800">
                            {log.entity_type}
                            {log.entity_id ? (
                              <span className="font-mono text-slate-500">
                                {' '}
                                ({log.entity_id.substring(0, 8)}…)
                              </span>
                            ) : null}
                          </td>
                          <td className="px-4 py-3.5 align-top">{severityBadge(log.severity)}</td>
                          <td className="px-4 py-3.5 align-top">{statusBadge(log.status)}</td>
                          <td className="px-4 py-3.5 min-w-0 align-top text-sm leading-relaxed text-slate-600">
                            <span className="block break-words">{formatAuditDescription(log)}</span>
                          </td>
                          {isDev && (
                            <td className="px-4 py-3.5 align-top">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedLog(selectedLog?.id === log.id ? null : log)
                                }
                                className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100"
                              >
                                {selectedLog?.id === log.id ? 'Hide' : 'View'}
                              </button>
                            </td>
                          )}
                        </tr>
                      ));
                    })()
                  )}
                </tbody>
              </table>
            </div>
            {!loading &&
              (() => {
                const q = searchQuery.trim().toLowerCase();
                const filtered = q
                  ? logs.filter((log) => {
                      const desc = formatAuditDescription(log);
                      return (
                        (log.action_type || '').toLowerCase().includes(q) ||
                        (log.entity_type || '').toLowerCase().includes(q) ||
                        (log.entity_id || '').toLowerCase().includes(q) ||
                        desc.toLowerCase().includes(q)
                      );
                    })
                  : logs;
                const totalItems = filtered.length;
                const totalPages = Math.max(1, Math.ceil(totalItems / TABLE_PAGE_SIZE));
                const start = (page - 1) * TABLE_PAGE_SIZE;
                const end = Math.min(start + TABLE_PAGE_SIZE, totalItems);
                if (totalItems === 0) return null;
                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3">
                    <p className="text-sm text-slate-600">
                      Showing{' '}
                      <span className="font-medium">
                        {start + 1}–{end}
                      </span>{' '}
                      of <span className="font-medium">{totalItems}</span>
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Previous
                      </button>
                      <span className="min-w-[7rem] text-center text-sm text-slate-600">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="rounded-md border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                );
              })()}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-14 text-center">
            <p className="text-sm font-medium text-slate-600">No audit logs found</p>
            <p className="mt-1.5 text-sm text-slate-400">
              Activity will appear here as changes occur
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
