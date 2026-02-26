'use client';

import { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import SuccessMetricsDashboard from '@/components/admin/success-metrics-dashboard';
import AdminAnalyticsTab from '@/components/admin/admin-analytics-tab';
import { AdminCronMonitorTab } from '@/components/admin/admin-cron-monitor-tab';
import { AdminAuthManagementTab } from '@/components/admin/admin-auth-management-tab';
import { AdminStorageOverviewTab } from '@/components/admin/admin-storage-overview-tab';
import { DashboardErrorBoundary } from '@/components/admin/dashboard-error-boundary';
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
  UsersTableBodySkeleton,
} from '@/components/ui/skeleton';
import { ROUTES, getAdminDashboardUrl } from '@/lib/utils/navigation';
import { SUCCESS_MESSAGES } from '@/config/constants';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
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
  const [overviewLoadSettled, setOverviewLoadSettled] = useState(false);
  const [overviewRetryKey, setOverviewRetryKey] = useState(0);
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
  const [trends, setTrends] = useState<BookingTrend[]>([]);
  const [revenueSnapshot, setRevenueSnapshot] = useState<{
    totalRevenue: number;
    revenueToday: number;
    revenueWeek: number;
    revenueMonth: number;
    paymentSuccessRate: number;
    failedPayments: number;
  } | null>(null);
  const [overviewExtras, setOverviewExtras] = useState<{
    failedBookingsLast24h: number;
    cronRunsLast24h: number;
    systemHealth: {
      status: string;
      cronExpireBookingsOk: boolean;
      cronExpireBookingsLastRun: string | null;
    };
  } | null>(null);

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

    fetch('/api/admin/check-status', { credentials: 'include', signal: ac.signal })
      .then((res) => res.json())
      .then(
        (statusData: {
          success?: boolean;
          data?: { is_admin?: boolean; user_type?: string; profile_exists?: boolean };
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

    Promise.allSettled([
      adminFetch('/api/admin/metrics', opts).then((r) => r.json()),
      adminFetch(`/api/admin/trends?days=${OVERVIEW_DAYS}`, opts).then((r) => r.json()),
      adminFetch(`/api/admin/revenue-metrics?days=${OVERVIEW_DAYS}`, opts).then((r) =>
        r.ok ? r.json() : null
      ),
      adminFetch('/api/admin/overview', opts).then((r) => (r.ok ? r.json() : null)),
    ]).then(([metricsResult, trendsResult, revenueResult, overviewResult]) => {
      setOverviewLoadSettled(true);
      if (metricsResult.status === 'fulfilled' && metricsResult.value?.success) {
        setMetrics(metricsResult.value.data);
      }
      if (trendsResult.status === 'fulfilled' && trendsResult.value?.success) {
        setTrends(trendsResult.value.data ?? []);
      }
      if (revenueResult.status === 'fulfilled' && revenueResult.value?.data) {
        const r = revenueResult.value.data;
        setRevenueSnapshot({
          totalRevenue: r.totalRevenue ?? 0,
          revenueToday: r.revenueToday ?? 0,
          revenueWeek: r.revenueWeek ?? 0,
          revenueMonth: r.revenueMonth ?? 0,
          paymentSuccessRate: r.paymentSuccessRate ?? 0,
          failedPayments: r.failedPayments ?? 0,
        });
      }
      if (overviewResult.status === 'fulfilled' && overviewResult.value?.data) {
        const o = overviewResult.value.data as {
          failedBookingsLast24h?: number;
          cronRunsLast24h?: number;
          systemHealth?: {
            status?: string;
            cronExpireBookingsOk?: boolean;
            cronExpireBookingsLastRun?: string | null;
          };
        };
        if (o.systemHealth) {
          setOverviewExtras({
            failedBookingsLast24h: o.failedBookingsLast24h ?? 0,
            cronRunsLast24h: o.cronRunsLast24h ?? 0,
            systemHealth: {
              status: o.systemHealth.status ?? 'unknown',
              cronExpireBookingsOk: o.systemHealth.cronExpireBookingsOk ?? false,
              cronExpireBookingsLastRun: o.systemHealth.cronExpireBookingsLastRun ?? null,
            },
          });
        }
      }
      const storedMetrics =
        metricsResult.status === 'fulfilled' && metricsResult.value?.success
          ? metricsResult.value.data
          : null;
      const storedTrends =
        trendsResult.status === 'fulfilled' && trendsResult.value?.success
          ? (trendsResult.value.data ?? [])
          : [];
      const revData =
        revenueResult.status === 'fulfilled' && revenueResult.value?.data
          ? revenueResult.value.data
          : null;
      setAdminCache(ADMIN_CACHE_KEYS.OVERVIEW, {
        metrics: storedMetrics,
        trends: storedTrends,
        revenueSnapshot: revData
          ? {
              totalRevenue: revData.totalRevenue ?? 0,
              revenueToday: revData.revenueToday ?? 0,
              revenueWeek: revData.revenueWeek ?? 0,
              revenueMonth: revData.revenueMonth ?? 0,
              paymentSuccessRate: revData.paymentSuccessRate ?? 0,
              failedPayments: revData.failedPayments ?? 0,
            }
          : null,
      });
    });
  }, [ready, adminConfirmed, prefetchListData, overviewRetryKey]);

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

  // Bar chart for Booking Trends (30 Days) - using different shades of black/gray
  const bookingTrendsChart = {
    labels: trends.map((t) => {
      const date = new Date(t.date);
      return `${date.getMonth() + 1}/${date.getDate()}`;
    }),
    datasets: [
      {
        label: 'Total Bookings',
        data: trends.map((t) => t.total),
        backgroundColor: 'rgb(0, 0, 0)', // Pure black
        borderColor: 'rgb(0, 0, 0)',
        borderWidth: 2,
      },
      {
        label: 'Confirmed',
        data: trends.map((t) => t.confirmed),
        backgroundColor: 'rgb(64, 64, 64)', // Dark gray
        borderColor: 'rgb(64, 64, 64)',
        borderWidth: 2,
      },
      {
        label: 'Rejected',
        data: trends.map((t) => t.rejected),
        backgroundColor: 'rgb(128, 128, 128)', // Medium gray
        borderColor: 'rgb(128, 128, 128)',
        borderWidth: 2,
      },
    ],
  };

  // Bar chart for Booking Status Distribution - using different shades
  const bookingStatusChart = metrics
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
              'rgb(0, 0, 0)', // Pure black - Confirmed
              'rgb(64, 64, 64)', // Dark gray - Pending
              'rgb(128, 128, 128)', // Medium gray - Rejected
              'rgb(192, 192, 192)', // Light gray - Cancelled
            ],
            borderColor: 'rgb(0, 0, 0)',
            borderWidth: 2,
          },
        ],
      }
    : null;

  // Line chart for Growth Trends - single line with different point colors
  const growthChart = metrics
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
            borderColor: 'rgb(0, 0, 0)', // Pure black line
            backgroundColor: 'rgba(0, 0, 0, 0.1)',
            borderWidth: 3,
            tension: 0.4,
            fill: true,
            pointRadius: 8,
            pointBackgroundColor: [
              'rgb(0, 0, 0)', // Pure black for Businesses
              'rgb(64, 64, 64)', // Dark gray for Bookings
              'rgb(128, 128, 128)', // Medium gray for Owners
            ],
            pointBorderColor: 'rgb(0, 0, 0)',
            pointBorderWidth: 2,
          },
        ],
      }
    : null;

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
                        <Bar
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
                        <Bar
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
                      <Line
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
                <BusinessesTab
                  page={currentPage}
                  onPageChange={(p) => router.replace(getAdminDashboardUrl('businesses', p))}
                />
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
                        <svg
                          className="h-4 w-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </div>
                  )}
                  <UsersTab
                    page={currentPage}
                    onPageChange={(p) => router.replace(getAdminDashboardUrl('users', p))}
                  />
                </div>
              )}

              {activeTab === 'bookings' && (
                <BookingsTab
                  page={currentPage}
                  onPageChange={(p) => router.replace(getAdminDashboardUrl('bookings', p))}
                />
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

function BusinessesTab({ page: controlledPage, onPageChange }: ListTabPageProps = {}) {
  const router = useRouter();
  const { session, ready } = useAdminSession();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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

  useEffect(() => {
    setError(null);
    const cached = getAdminCached<any[]>(ADMIN_CACHE_KEYS.BUSINESSES);
    if (cached && Array.isArray(cached)) {
      setBusinesses(cached);
      setLoading(false);
      return;
    }
    const stale = getAdminCachedStale<any[]>(ADMIN_CACHE_KEYS.BUSINESSES);
    if (stale?.data && Array.isArray(stale.data)) {
      setBusinesses(stale.data);
      setLoading(false);
      if (!ready || !session) return;
      adminFetch('/api/admin/businesses', { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            const list = Array.isArray(data.data) ? data.data : [];
            setBusinesses(list);
            setAdminCache(ADMIN_CACHE_KEYS.BUSINESSES, list);
          }
        })
        .catch(() => {});
      return;
    }
    if (!ready || !session) {
      setError('Session expired. Please log in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const ac = new AbortController();
    adminFetch('/api/admin/businesses', { credentials: 'include', signal: ac.signal })
      .then((r) => r.json())
      .then((data) => {
        if (ac.signal.aborted) return;
        if (data.success) {
          const list = Array.isArray(data.data) ? data.data : [];
          setBusinesses(list);
          setAdminCache(ADMIN_CACHE_KEYS.BUSINESSES, list);
        } else {
          setError(data.error || 'Failed to load businesses');
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load businesses');
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [ready, session]);

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Businesses</h2>
          <p className="text-sm text-slate-500 mt-0.5">All platform businesses — view and manage</p>
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
      <div>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Businesses</h2>
        <p className="text-sm text-slate-500 mt-0.5">All platform businesses — view and manage</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Business list</h3>
          </div>
          {businesses.length > 0 && (
            <input
              type="search"
              placeholder="Search businesses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
              aria-label="Search businesses"
            />
          )}
        </div>
        {businesses.length > 0 || loading ? (
          <div className="overflow-hidden rounded-xl border border-slate-200 shadow-sm">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/80">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 min-w-[180px]">
                      Business name
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 min-w-[160px]">
                      Owner
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 min-w-[140px]">
                      Location
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 w-24">
                      Bookings
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600 w-28">
                      Status
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-600 w-24">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading && businesses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                        Loading businesses...
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const q = searchQuery.trim().toLowerCase();
                      const filtered = q
                        ? businesses.filter(
                            (b) =>
                              (b.salon_name || b.name || '').toLowerCase().includes(q) ||
                              (b.booking_link || '').toLowerCase().includes(q) ||
                              (b.owner?.full_name || b.owner_name || '')
                                .toLowerCase()
                                .includes(q) ||
                              (b.owner?.email || '').toLowerCase().includes(q) ||
                              (b.location || '').toLowerCase().includes(q)
                          )
                        : businesses;
                      const start = (page - 1) * TABLE_PAGE_SIZE;
                      const paginated = filtered.slice(start, start + TABLE_PAGE_SIZE);
                      return paginated.map((business) => (
                        <tr key={business.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-4 align-top">
                            <div className="text-sm font-semibold text-slate-900">
                              {business.salon_name || business.name || 'N/A'}
                            </div>
                            <div
                              className="mt-0.5 text-xs text-slate-500 font-mono truncate max-w-[200px]"
                              title={business.booking_link}
                            >
                              {business.booking_link || '—'}
                            </div>
                          </td>
                          <td className="px-5 py-4 align-top min-w-0">
                            <div className="text-sm font-medium text-slate-900">
                              {business.owner?.full_name || business.owner_name || '—'}
                            </div>
                            <div
                              className="mt-0.5 text-xs text-slate-500 truncate max-w-[180px]"
                              title={business.owner?.email}
                            >
                              {business.owner?.email || '—'}
                            </div>
                          </td>
                          <td className="px-5 py-4 text-sm text-slate-600 align-top max-w-[200px]">
                            <span
                              className="block break-words line-clamp-2"
                              title={business.location || undefined}
                            >
                              {business.location || '—'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right align-top">
                            <span className="text-sm font-medium tabular-nums text-slate-900">
                              {business.bookingCount ?? 0}
                            </span>
                          </td>
                          <td className="px-5 py-4 align-top">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                business.suspended
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-emerald-100 text-emerald-800'
                              }`}
                            >
                              {business.suspended ? 'Suspended' : 'Active'}
                            </span>
                          </td>
                          <td className="px-5 py-4 text-right align-top">
                            <button
                              onClick={() => router.push(ROUTES.ADMIN_BUSINESS(business.id))}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 hover:border-slate-300 transition-colors"
                            >
                              Edit
                            </button>
                          </td>
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
                  ? businesses.filter(
                      (b) =>
                        (b.salon_name || b.name || '').toLowerCase().includes(q) ||
                        (b.booking_link || '').toLowerCase().includes(q) ||
                        (b.owner?.full_name || b.owner_name || '').toLowerCase().includes(q) ||
                        (b.owner?.email || '').toLowerCase().includes(q) ||
                        (b.location || '').toLowerCase().includes(q)
                    )
                  : businesses;
                const totalItems = filtered.length;
                const totalPages = Math.max(1, Math.ceil(totalItems / TABLE_PAGE_SIZE));
                const start = (page - 1) * TABLE_PAGE_SIZE;
                const end = Math.min(start + TABLE_PAGE_SIZE, totalItems);
                if (totalItems === 0) return null;
                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-3">
                    <p className="text-sm text-slate-600">
                      Showing {start + 1}–{end} of {totalItems}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-600">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                );
              })()}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
            <p className="text-sm font-medium text-slate-500">No businesses found</p>
            <p className="mt-1 text-xs text-slate-400">
              Businesses will appear here when they exist
            </p>
          </div>
        )}
      </section>
    </div>
  );
}

function UsersTab({ page: controlledPage, onPageChange }: ListTabPageProps = {}) {
  const router = useRouter();
  const { session, ready } = useAdminSession();
  const [users, setUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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

  useEffect(() => {
    setError(null);
    const cached = getAdminCached<any[]>(ADMIN_CACHE_KEYS.USERS);
    if (cached && Array.isArray(cached)) {
      setUsers(cached);
      setLoading(false);
      return;
    }
    const stale = getAdminCachedStale<any[]>(ADMIN_CACHE_KEYS.USERS);
    if (stale?.data && Array.isArray(stale.data)) {
      setUsers(stale.data);
      setLoading(false);
      if (!ready || !session) return;
      adminFetch(`/api/admin/users?limit=${LIST_LIMIT}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            const list = Array.isArray(data.data) ? data.data : [];
            setUsers(list);
            setAdminCache(ADMIN_CACHE_KEYS.USERS, list);
          }
        })
        .catch(() => {});
      return;
    }
    if (!ready || !session) {
      setError('Session expired. Please log in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const ac = new AbortController();
    adminFetch(`/api/admin/users?limit=${LIST_LIMIT}`, {
      credentials: 'include',
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (ac.signal.aborted) return;
        if (data.success) {
          const list = Array.isArray(data.data) ? data.data : [];
          setUsers(list);
          setAdminCache(ADMIN_CACHE_KEYS.USERS, list);
        } else {
          setError(data.error || 'Failed to load users');
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load users');
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [ready, session]);

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Users</h2>
          <p className="text-sm text-slate-500 mt-0.5">All platform users — roles and activity</p>
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
      <div>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Users</h2>
        <p className="text-sm text-slate-500 mt-0.5">All platform users — roles and activity</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">User list</h3>
          </div>
          {users.length > 0 && (
            <input
              type="search"
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-56 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
              aria-label="Search users"
            />
          )}
        </div>
        {users.length > 0 || loading ? (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Name
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Email
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Type
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Businesses
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Bookings
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading && users.length === 0 ? (
                    <UsersTableBodySkeleton />
                  ) : (
                    (() => {
                      const q = searchQuery.trim().toLowerCase();
                      const filtered = q
                        ? users.filter(
                            (u) =>
                              (u.full_name || '').toLowerCase().includes(q) ||
                              (u.email || '').toLowerCase().includes(q) ||
                              (u.user_type || '').toLowerCase().includes(q)
                          )
                        : users;
                      const start = (page - 1) * TABLE_PAGE_SIZE;
                      const paginated = filtered.slice(start, start + TABLE_PAGE_SIZE);
                      return paginated.map((user) => (
                        <tr key={user.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                            {user.full_name || 'N/A'}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-600">
                            {user.email}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-800">
                              {user.user_type}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-900">
                            {user.businesses?.length || 0}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-900">
                            {user.bookingCount || 0}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => router.push(ROUTES.ADMIN_USER(user.id))}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                            >
                              Manage
                            </button>
                          </td>
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
                  ? users.filter(
                      (u) =>
                        (u.full_name || '').toLowerCase().includes(q) ||
                        (u.email || '').toLowerCase().includes(q) ||
                        (u.user_type || '').toLowerCase().includes(q)
                    )
                  : users;
                const totalItems = filtered.length;
                const totalPages = Math.max(1, Math.ceil(totalItems / TABLE_PAGE_SIZE));
                const start = (page - 1) * TABLE_PAGE_SIZE;
                const end = Math.min(start + TABLE_PAGE_SIZE, totalItems);
                if (totalItems === 0) return null;
                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-3">
                    <p className="text-sm text-slate-600">
                      Showing {start + 1}–{end} of {totalItems}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-600">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                );
              })()}
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
            <p className="text-sm font-medium text-slate-500">No users found</p>
            <p className="mt-1 text-xs text-slate-400">Users will appear here when they exist</p>
          </div>
        )}
      </section>
    </div>
  );
}

function BookingsTab({ page: controlledPage, onPageChange }: ListTabPageProps = {}) {
  const router = useRouter();
  const { session, ready } = useAdminSession();
  const [bookings, setBookings] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
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

  useEffect(() => {
    setError(null);
    const cached = getAdminCached<any[]>(ADMIN_CACHE_KEYS.BOOKINGS);
    if (cached && Array.isArray(cached)) {
      setBookings(cached);
      setLoading(false);
      return;
    }
    const stale = getAdminCachedStale<any[]>(ADMIN_CACHE_KEYS.BOOKINGS);
    if (stale?.data && Array.isArray(stale.data)) {
      setBookings(stale.data);
      setLoading(false);
      if (!ready || !session) return;
      adminFetch(`/api/admin/bookings?limit=${LIST_LIMIT}`, { credentials: 'include' })
        .then((r) => r.json())
        .then((data) => {
          if (data.success) {
            const list = Array.isArray(data.data) ? data.data : [];
            setBookings(list);
            setAdminCache(ADMIN_CACHE_KEYS.BOOKINGS, list);
          }
        })
        .catch(() => {});
      return;
    }
    if (!ready || !session) {
      setError('Session expired. Please log in again.');
      setLoading(false);
      return;
    }
    setLoading(true);
    const ac = new AbortController();
    adminFetch(`/api/admin/bookings?limit=${LIST_LIMIT}`, {
      credentials: 'include',
      signal: ac.signal,
    })
      .then((r) => r.json())
      .then((data) => {
        if (ac.signal.aborted) return;
        if (data.success) {
          const list = Array.isArray(data.data) ? data.data : [];
          setBookings(list);
          setAdminCache(ADMIN_CACHE_KEYS.BOOKINGS, list);
        } else {
          setError(data.error || 'Failed to load bookings');
        }
      })
      .catch((err) => {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load bookings');
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [ready, session]);

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Bookings</h2>
          <p className="mt-0.5 text-sm text-slate-500">All platform bookings — view and manage</p>
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
      <div>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Bookings</h2>
        <p className="mt-0.5 text-sm text-slate-500">All platform bookings — view and manage</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4 border-b border-slate-200 bg-slate-50/60">
          <h3 className="text-base font-semibold text-slate-800">Booking list</h3>
          <div className="relative">
            <input
              type="search"
              placeholder="Search bookings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-64 rounded-lg border border-slate-200 bg-white py-2.5 pl-3 pr-4 text-sm text-slate-900 placeholder-slate-400 shadow-sm focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-200"
              aria-label="Search bookings"
            />
          </div>
        </div>
        {bookings.length > 0 || loading ? (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-100 border-b-2 border-slate-200">
                  <tr>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Customer name
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Business
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Phone
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Date & time
                    </th>
                    <th className="px-5 py-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Status
                    </th>
                    <th className="px-5 py-4 text-right text-xs font-semibold uppercase tracking-wider text-slate-700">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {loading && bookings.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-5 py-12 text-center text-sm text-slate-500">
                        Loading bookings...
                      </td>
                    </tr>
                  ) : (
                    (() => {
                      const q = searchQuery.trim().toLowerCase();
                      const filtered = q
                        ? bookings.filter(
                            (b) =>
                              (b.customer_name || '').toLowerCase().includes(q) ||
                              (b.business?.salon_name || b.business?.name || '')
                                .toLowerCase()
                                .includes(q) ||
                              (b.customer_phone || '').toLowerCase().includes(q) ||
                              (b.status || '').toLowerCase().includes(q) ||
                              (b.slot?.date
                                ? new Date(b.slot.date)
                                    .toLocaleDateString()
                                    .toLowerCase()
                                    .includes(q)
                                : false)
                          )
                        : bookings;
                      const start = (page - 1) * TABLE_PAGE_SIZE;
                      const paginated = filtered.slice(start, start + TABLE_PAGE_SIZE);
                      return paginated.map((booking) => (
                        <tr key={booking.id} className="hover:bg-slate-50/80 transition-colors">
                          <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                            {booking.customer_name || '—'}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-900">
                            {booking.business?.salon_name || booking.business?.name || 'N/A'}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-600">
                            {booking.customer_phone || '—'}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-600">
                            {booking.slot ? (
                              <>
                                {new Date(booking.slot.date).toLocaleDateString()}
                                <br />
                                <span className="text-slate-500">
                                  {booking.slot.start_time} – {booking.slot.end_time}
                                </span>
                              </>
                            ) : (
                              'N/A'
                            )}
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                                booking.status === 'confirmed'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : booking.status === 'rejected'
                                    ? 'bg-red-100 text-red-800'
                                    : booking.status === 'pending'
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {booking.status}
                            </span>
                          </td>
                          <td className="px-5 py-4 whitespace-nowrap text-right">
                            <button
                              onClick={() => router.push(ROUTES.ADMIN_BOOKING(booking.id))}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
                            >
                              Manage
                            </button>
                          </td>
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
                  ? bookings.filter(
                      (b) =>
                        (b.customer_name || '').toLowerCase().includes(q) ||
                        (b.business?.salon_name || b.business?.name || '')
                          .toLowerCase()
                          .includes(q) ||
                        (b.customer_phone || '').toLowerCase().includes(q) ||
                        (b.status || '').toLowerCase().includes(q) ||
                        (b.slot?.date
                          ? new Date(b.slot.date).toLocaleDateString().toLowerCase().includes(q)
                          : false)
                    )
                  : bookings;
                const totalItems = filtered.length;
                const totalPages = Math.max(1, Math.ceil(totalItems / TABLE_PAGE_SIZE));
                const start = (page - 1) * TABLE_PAGE_SIZE;
                const end = Math.min(start + TABLE_PAGE_SIZE, totalItems);
                if (totalItems === 0) return null;
                return (
                  <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50/50 px-5 py-3">
                    <p className="text-sm text-slate-600">
                      Showing {start + 1}–{end} of {totalItems}
                    </p>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.max(1, p - 1))}
                        disabled={page <= 1}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-slate-600">
                        Page {page} of {totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                        disabled={page >= totalPages}
                        className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Next
                      </button>
                    </div>
                  </div>
                );
              })()}
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center mx-6 mb-6">
            <p className="text-sm font-medium text-slate-500">No bookings found</p>
            <p className="mt-1 text-xs text-slate-400">Bookings will appear here when they exist</p>
          </div>
        )}
      </section>
    </div>
  );
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
  const isDev = process.env.NODE_ENV === 'development';

  const hasFilters =
    filterSeverity !== '' ||
    filterStatus !== '' ||
    filterActorRole !== '' ||
    filterActionGroup !== '';

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
    const params = new URLSearchParams({ limit: String(AUDIT_LOGS_FETCH_LIMIT) });
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
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterSeverity}
              onChange={(e) => {
                setFilterSeverity(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
              aria-label="Filter by severity"
            >
              {AUDIT_SEVERITY_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => {
                setFilterStatus(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
              aria-label="Filter by status"
            >
              {AUDIT_STATUS_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={filterActionGroup}
              onChange={(e) => {
                setFilterActionGroup(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
              aria-label="Filter by action group"
            >
              {AUDIT_ACTION_GROUP_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
            <select
              value={filterActorRole}
              onChange={(e) => {
                setFilterActorRole(e.target.value);
                setPage(1);
              }}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-300"
              aria-label="Filter by actor role"
            >
              {AUDIT_ACTOR_ROLE_OPTIONS.map((o) => (
                <option key={o.value || 'all'} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
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
