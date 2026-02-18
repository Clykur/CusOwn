'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { supabaseAuth, getUserProfile, isAdmin } from '@/lib/supabase/auth';
import SuccessMetricsDashboard from '@/components/admin/success-metrics-dashboard';
import AdminAnalyticsTab from '@/components/admin/admin-analytics-tab';
import AdminSidebar from '@/components/admin/admin-sidebar';
import { DashboardErrorBoundary } from '@/components/admin/dashboard-error-boundary';
import {
  AdminDashboardSkeleton,
  AdminAnalyticsSkeleton,
  AuditLogsSkeleton,
  BookingsSkeleton,
  BusinessesSkeleton,
  OverviewSkeleton,
  UsersSkeleton,
} from '@/components/ui/skeleton';
import { ROUTES } from '@/lib/utils/navigation';
import { getCSRFToken, clearCSRFToken } from '@/lib/utils/csrf-client';
import { Line, Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
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

function AdminDashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
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
  const [activeTab, setActiveTab] = useState<
    'overview' | 'businesses' | 'users' | 'bookings' | 'audit' | 'success-metrics' | 'analytics'
  >('overview');

  useEffect(() => {
    const tab = searchParams?.get('tab') as typeof activeTab;
    if (
      tab &&
      [
        'overview',
        'businesses',
        'users',
        'bookings',
        'audit',
        'success-metrics',
        'analytics',
      ].includes(tab)
    ) {
      setActiveTab(tab);
    } else if (!tab) {
      setActiveTab('overview');
    }
  }, [searchParams]);

  useEffect(() => {
    const checkAuth = async () => {
      if (!supabaseAuth) {
        setError('Supabase is not configured');
        setLoading(false);
        return;
      }
      const {
        data: { session },
      } = await supabaseAuth.auth.getSession();
      if (!session?.user) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.ADMIN_DASHBOARD));
        return;
      }

      setUser(session.user);
      const token = session.access_token;
      const headers = { Authorization: `Bearer ${token}` };

      const [statusRes, metricsRes, trendsRes, revenueRes] = await Promise.all([
        fetch('/api/admin/check-status', { headers }),
        fetch('/api/admin/metrics', { headers }),
        fetch('/api/admin/trends?days=30', { headers }),
        fetch('/api/admin/revenue-metrics?days=30', { headers }),
      ]);

      const [statusData, metricsData, trendsData, revenueData] = await Promise.all([
        statusRes.json(),
        metricsRes.json(),
        trendsRes.json(),
        revenueRes.ok ? revenueRes.json() : Promise.resolve(null),
      ]);

      if (!statusData.success) {
        setError(statusData.error || 'Failed to check admin status');
        setLoading(false);
        return;
      }

      const { is_admin, user_type, profile_exists } = statusData.data;
      if (!is_admin) {
        if (!profile_exists) {
          setError(
            `Your profile doesn't exist yet. User type: ${user_type || 'none'}. Please contact support or use the migration query to set admin status.`
          );
        } else {
          setError(
            `You don't have admin access. Current user type: ${user_type}. Please run the migration query to set your account as admin.`
          );
        }
        setLoading(false);
        return;
      }

      if (metricsRes.ok && metricsData?.success) setMetrics(metricsData.data);
      if (trendsRes.ok && trendsData?.success) setTrends(trendsData.data);
      if (revenueData?.success && revenueData.data) {
        const r = revenueData.data;
        setRevenueSnapshot({
          totalRevenue: r.totalRevenue ?? 0,
          revenueToday: r.revenueToday ?? 0,
          revenueWeek: r.revenueWeek ?? 0,
          revenueMonth: r.revenueMonth ?? 0,
          paymentSuccessRate: r.paymentSuccessRate ?? 0,
          failedPayments: r.failedPayments ?? 0,
        });
      }
      setLoading(false);
    };

    checkAuth();
  }, [router]);

  if (loading) {
    const tabFromUrl = searchParams?.get('tab');
    const isAnalyticsTab = tabFromUrl === 'analytics';
    return (
      <div className="min-h-screen bg-white flex">
        <AdminSidebar />
        <div className="flex-1 lg:ml-64 flex flex-col min-h-0">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1 flex flex-col min-h-0 w-full">
            {isAnalyticsTab ? <AdminAnalyticsSkeleton /> : <AdminDashboardSkeleton />}
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex">
        <AdminSidebar />
        <div className="flex-1 lg:ml-64 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
            <p className="text-gray-600 mb-4">{error}</p>

            {error.includes('migration') && (
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
                      if (!supabaseAuth) {
                        alert('Supabase not configured');
                        return;
                      }
                      const {
                        data: { session },
                      } = await supabaseAuth.auth.getSession();
                      if (!session) {
                        alert('Session expired. Please log in again.');
                        return;
                      }
                      const csrfToken = await getCSRFToken();
                      const headers: Record<string, string> = {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
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
                        alert('Admin status set! Please refresh the page.');
                        window.location.reload();
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
    <div className="min-h-screen bg-white flex">
      <AdminSidebar />
      <div className="flex-1 lg:ml-64">
        <DashboardErrorBoundary>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            {activeTab === 'overview' && !metrics && <OverviewSkeleton />}
            {activeTab === 'overview' && metrics && (
              <div className="space-y-8">
                <div>
                  <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Overview</h2>
                  <p className="text-sm text-slate-500 mt-0.5">Platform-wide metrics at a glance</p>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-slate-900">Core metrics</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Businesses, bookings and owners</p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        Total businesses
                      </p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                        {metrics.totalBusinesses}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {metrics.growthRate.businesses > 0 ? '+' : ''}
                        {metrics.growthRate.businesses.toFixed(1)}% growth
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        Active businesses
                      </p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                        {metrics.activeBusinesses}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {metrics.suspendedBusinesses} suspended
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        Total bookings
                      </p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                        {metrics.totalBookings}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {metrics.growthRate.bookings > 0 ? '+' : ''}
                        {metrics.growthRate.bookings.toFixed(1)}% growth
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        Total owners
                      </p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                        {metrics.totalOwners}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {metrics.growthRate.owners > 0 ? '+' : ''}
                        {metrics.growthRate.owners.toFixed(1)}% growth
                      </p>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-slate-900">Booking volume</h3>
                    <p className="text-sm text-slate-500 mt-0.5">
                      Today, this week, this month and customers
                    </p>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        Bookings today
                      </p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                        {metrics.bookingsToday}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        This week
                      </p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                        {metrics.bookingsThisWeek}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        This month
                      </p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                        {metrics.bookingsThisMonth}
                      </p>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                        Total customers
                      </p>
                      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">
                        {metrics.totalCustomers}
                      </p>
                    </div>
                  </div>
                </section>

                {revenueSnapshot && (
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Revenue (last 30 days)
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5">Totals and payment success</p>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      <div className="rounded-xl border border-slate-200 p-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                          Total revenue
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                          ₹{revenueSnapshot.totalRevenue.toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                          Today
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                          ₹{revenueSnapshot.revenueToday.toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                          This week
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                          ₹{revenueSnapshot.revenueWeek.toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                          This month
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                          ₹{revenueSnapshot.revenueMonth.toFixed(2)}
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                          Payment success %
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {revenueSnapshot.paymentSuccessRate.toFixed(2)}%
                        </p>
                      </div>
                      <div className="rounded-xl border border-slate-200 p-4">
                        <p className="text-xs font-medium uppercase tracking-wider text-slate-500">
                          Failed payments
                        </p>
                        <p className="mt-1 text-lg font-bold text-slate-900">
                          {revenueSnapshot.failedPayments}
                        </p>
                      </div>
                    </div>
                  </section>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Booking trends (30 days)
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Daily totals and status breakdown
                      </p>
                    </div>
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
                  </section>

                  <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Booking status distribution
                      </h3>
                      <p className="text-sm text-slate-500 mt-0.5">
                        Confirmed, pending, rejected, cancelled
                      </p>
                    </div>
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
                  </section>
                </div>

                <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
                  <div className="mb-6">
                    <h3 className="text-lg font-semibold text-slate-900">Growth trends</h3>
                    <p className="text-sm text-slate-500 mt-0.5">Growth rate by category</p>
                  </div>
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
                </section>
              </div>
            )}

            {activeTab === 'businesses' && <BusinessesTab />}

            {activeTab === 'users' && <UsersTab />}

            {activeTab === 'bookings' && <BookingsTab />}

            {activeTab === 'audit' && <AuditLogsTab />}

            {activeTab === 'success-metrics' && <SuccessMetricsDashboard />}

            {activeTab === 'analytics' && <AdminAnalyticsTab />}
          </div>
        </DashboardErrorBoundary>
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense fallback={<AdminDashboardSkeleton />}>
      <AdminDashboardContent />
    </Suspense>
  );
}

function BusinessesTab() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const ac = new AbortController();
    (async () => {
      try {
        if (!supabaseAuth) {
          setError('Supabase is not configured');
          setLoading(false);
          return;
        }
        const {
          data: { session },
        } = await supabaseAuth.auth.getSession();
        if (ac.signal.aborted) return;
        if (!session) {
          setError('Session expired. Please log in again.');
          setLoading(false);
          return;
        }
        const res = await fetch('/api/admin/businesses', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: ac.signal,
        });
        const data = await res.json();
        if (ac.signal.aborted) return;
        if (data.success) {
          setBusinesses(Array.isArray(data.data) ? data.data : []);
        } else {
          setError(data.error || 'Failed to load businesses');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load businesses');
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  if (loading) {
    return <BusinessesSkeleton />;
  }

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
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Business list</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Name, owner, location, bookings and status
          </p>
        </div>
        {businesses.length > 0 ? (
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
                  {businesses.map((business) => (
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
                  ))}
                </tbody>
              </table>
            </div>
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

function UsersTab() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const ac = new AbortController();
    (async () => {
      try {
        if (!supabaseAuth) {
          setError('Supabase is not configured');
          setLoading(false);
          return;
        }
        const {
          data: { session },
        } = await supabaseAuth.auth.getSession();
        if (ac.signal.aborted) return;
        if (!session) {
          setError('Session expired. Please log in again.');
          setLoading(false);
          return;
        }
        const res = await fetch('/api/admin/users', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: ac.signal,
        });
        const data = await res.json();
        if (ac.signal.aborted) return;
        if (data.success) {
          setUsers(Array.isArray(data.data) ? data.data : []);
        } else {
          setError(data.error || 'Failed to load users');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load users');
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  if (loading) {
    return <UsersSkeleton />;
  }

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
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900">User list</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Name, email, type, businesses and bookings
          </p>
        </div>
        {users.length > 0 ? (
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
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {users.map((user) => (
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
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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

function BookingsTab() {
  const router = useRouter();
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setError(null);
    const ac = new AbortController();
    (async () => {
      try {
        if (!supabaseAuth) {
          setError('Supabase is not configured');
          setLoading(false);
          return;
        }
        const {
          data: { session },
        } = await supabaseAuth.auth.getSession();
        if (ac.signal.aborted) return;
        if (!session) {
          setError('Session expired. Please log in again.');
          setLoading(false);
          return;
        }
        const res = await fetch('/api/admin/bookings?limit=50', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: ac.signal,
        });
        const data = await res.json();
        if (ac.signal.aborted) return;
        if (data.success) {
          setBookings(Array.isArray(data.data) ? data.data : []);
        } else {
          setError(data.error || 'Failed to load bookings');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load bookings');
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  if (loading) {
    return <BookingsSkeleton />;
  }

  if (error) {
    return (
      <div className="space-y-8">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Bookings</h2>
          <p className="text-sm text-slate-500 mt-0.5">All platform bookings — view and manage</p>
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
        <p className="text-sm text-slate-500 mt-0.5">All platform bookings — view and manage</p>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Booking list</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Customer name, phone, business, slot and status
          </p>
        </div>
        {bookings.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Customer name
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Business
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Phone
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Date & time
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Status
                    </th>
                    <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {bookings.map((booking) => (
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
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
            <p className="text-sm font-medium text-slate-500">No bookings found</p>
            <p className="mt-1 text-xs text-slate-400">Bookings will appear here when they exist</p>
          </div>
        )}
      </section>
    </div>
  );
}

function AuditLogsTab() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const isDev = process.env.NODE_ENV === 'development';

  useEffect(() => {
    setError(null);
    const ac = new AbortController();
    (async () => {
      try {
        if (!supabaseAuth) {
          setError('Supabase is not configured');
          setLoading(false);
          return;
        }
        const {
          data: { session },
        } = await supabaseAuth.auth.getSession();
        if (ac.signal.aborted) return;
        if (!session) {
          setError('Session expired. Please log in again.');
          setLoading(false);
          return;
        }
        const res = await fetch('/api/admin/audit-logs?limit=100', {
          headers: { Authorization: `Bearer ${session.access_token}` },
          signal: ac.signal,
        });
        const data = await res.json();
        if (ac.signal.aborted) return;
        if (data.success) {
          setLogs(Array.isArray(data.data) ? data.data : []);
        } else {
          setError(data.error || 'Failed to load audit logs');
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return;
        setError(err instanceof Error ? err.message : 'Failed to load audit logs');
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    })();
    return () => ac.abort();
  }, []);

  const sentenceCase = (s: string) => (s.length ? s[0].toUpperCase() + s.slice(1) : s);
  const humanAction = (action: string) =>
    action.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

  const formatAuditDescription = (log: any): string => {
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

    // Custom description (no arrow syntax)
    if (log.description && !log.description.includes('→')) {
      const d = String(log.description).trim();
      return d.endsWith('.') ? d : sentenceCase(d) + '.';
    }

    // Technical description with arrows: "key→value" or "key: old→new"
    if (log.description) {
      const d = log.description.replace(/→/g, ' → ').replace(/:/g, ': ').replace(/,/g, ', ');
      const parts = d.split(/\s*→\s*/);
      if (parts.length >= 2) {
        const first = parts[0].trim();
        const rest = parts.slice(1).join(' → ').trim();
        return `${sentenceCase(first)} changed to ${rest}.`;
      }
      return sentenceCase(d.trim()) + (d.trim().endsWith('.') ? '' : '.');
    }

    return humanAction(actionType) + ' performed.';
  };

  if (loading) {
    return <AuditLogsSkeleton />;
  }

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

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Activity log</h3>
          <p className="text-sm text-slate-500 mt-0.5">Timestamp, action, entity and description</p>
        </div>
        {logs.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Timestamp
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Action
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Entity
                    </th>
                    <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                      Description
                    </th>
                    {isDev && (
                      <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                        Debug
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-5 py-4 whitespace-nowrap text-sm text-slate-500">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="inline-flex rounded-full px-2.5 py-1 text-xs font-semibold bg-slate-100 text-slate-800">
                          {log.action_type?.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                        {log.entity_type}{' '}
                        {log.entity_id ? `(${log.entity_id.substring(0, 8)}…)` : ''}
                      </td>
                      <td className="px-5 py-4 text-sm text-slate-600 max-w-md align-top">
                        <span className="block break-words whitespace-pre-wrap">
                          {formatAuditDescription(log)}
                        </span>
                      </td>
                      {isDev && (
                        <td className="px-5 py-4 whitespace-nowrap text-sm">
                          <button
                            onClick={() => setSelectedLog(selectedLog?.id === log.id ? null : log)}
                            className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-800 hover:bg-amber-100 text-xs font-medium transition-colors"
                          >
                            {selectedLog?.id === log.id ? 'Hide' : 'View'}
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
            <p className="text-sm font-medium text-slate-500">No audit logs found</p>
            <p className="mt-1 text-xs text-slate-400">
              Activity will appear here as changes occur
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
