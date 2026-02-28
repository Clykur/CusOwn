'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminSession } from '@/components/admin/admin-session-context';
import {
  getAdminCached,
  getAdminCachedStale,
  setAdminCache,
  getAdminAnalyticsCacheKey,
} from '@/components/admin/admin-cache';
import { adminFetch } from '@/lib/utils/admin-fetch.client';
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
  Filler,
} from 'chart.js';
import type {
  AdminRevenueMetrics,
  AdminBookingFunnel,
  AdminBusinessHealthItem,
  AdminSystemMetrics,
} from '@/types';
import { AdminAnalyticsSkeleton } from '@/components/ui/skeleton';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const DEFAULT_DAYS = 30;

function toDateOnly(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatCurrency(n: number): string {
  if (n >= 1_00_000) return `₹${(n / 1_00_000).toFixed(2)}L`;
  if (n >= 1_000) return `₹${(n / 1_000).toFixed(2)}K`;
  return `₹${n.toFixed(2)}`;
}

function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-IN').format(n);
}

function formatPercent(n: number): string {
  return `${n.toFixed(1)}%`;
}

const CHART_COLORS = {
  primary: 'rgb(16, 185, 129)',
  primaryLight: 'rgba(16, 185, 129, 0.12)',
  secondary: 'rgb(15, 23, 42)',
  secondaryLight: 'rgba(15, 23, 42, 0.08)',
  success: 'rgb(34, 197, 94)',
  warning: 'rgb(234, 179, 8)',
  danger: 'rgb(239, 68, 68)',
  neutral: ['rgb(15, 23, 42)', 'rgb(71, 85, 105)', 'rgb(148, 163, 184)', 'rgb(203, 213, 225)'],
};

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: true,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { usePointStyle: true, padding: 16 },
    },
    tooltip: {
      backgroundColor: 'rgb(15, 23, 42)',
      padding: 12,
      titleFont: { size: 13 },
      bodyFont: { size: 12 },
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: { maxRotation: 45, font: { size: 11 } },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(0,0,0,0.06)' },
      ticks: { font: { size: 11 } },
    },
  },
};

type AnalyticsCachePayload = {
  revenue: AdminRevenueMetrics | null;
  funnel: AdminBookingFunnel | null;
  health: AdminBusinessHealthItem[] | null;
  system: AdminSystemMetrics | null;
};

export default function AdminAnalyticsTab() {
  const { token } = useAdminSession();
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - DEFAULT_DAYS);
    return toDateOnly(d);
  });
  const [endDate, setEndDate] = useState(() => toDateOnly(new Date()));
  const [revenue, setRevenue] = useState<AdminRevenueMetrics | null>(null);
  const [funnel, setFunnel] = useState<AdminBookingFunnel | null>(null);
  const [health, setHealth] = useState<AdminBusinessHealthItem[] | null>(null);
  const [system, setSystem] = useState<AdminSystemMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(() => {
    if (!token) return;
    setError(null);
    setLoading(true);
    const params = new URLSearchParams({
      startDate: `${startDate}T00:00:00.000Z`,
      endDate: `${endDate}T23:59:59.999Z`,
    });
    const opts = { token, credentials: 'include' as RequestCredentials };
    const cacheKey = getAdminAnalyticsCacheKey(startDate, endDate);

    const revP = adminFetch(`/api/admin/revenue-metrics?${params}`, opts)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) setRevenue(data.data);
        else setRevenue(null);
        return data;
      });
    const funP = adminFetch(`/api/admin/booking-funnel?${params}`, opts)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) setFunnel(data.data);
        else setFunnel(null);
        return data;
      });
    const healthP = adminFetch(`/api/admin/business-health?${params}&limit=20`, opts)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) setHealth(data.data);
        else setHealth([]);
        return data;
      });
    const sysP = adminFetch('/api/admin/system-metrics', opts)
      .then((r) => r.json())
      .then((data) => {
        if (data?.success) setSystem(data.data);
        else setSystem(null);
        return data;
      });

    Promise.allSettled([revP, funP, healthP, sysP])
      .then(([rev, fun, healthRes, sys]) => {
        const payload: AnalyticsCachePayload = {
          revenue: rev.status === 'fulfilled' && rev.value?.success ? rev.value.data : null,
          funnel: fun.status === 'fulfilled' && fun.value?.success ? fun.value.data : null,
          health:
            healthRes.status === 'fulfilled' && healthRes.value?.success
              ? healthRes.value.data
              : null,
          system: sys.status === 'fulfilled' && sys.value?.success ? sys.value.data : null,
        };
        setAdminCache(cacheKey, payload);
        setLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Failed to load analytics');
        setLoading(false);
      });
  }, [startDate, endDate, token]);

  useEffect(() => {
    const cacheKey = getAdminAnalyticsCacheKey(startDate, endDate);
    const cached = getAdminCached<AnalyticsCachePayload>(cacheKey);
    if (cached) {
      setRevenue(cached.revenue ?? null);
      setFunnel(cached.funnel ?? null);
      setHealth(cached.health ?? null);
      setSystem(cached.system ?? null);
      setLoading(false);
      return;
    }
    const stale = getAdminCachedStale<AnalyticsCachePayload>(cacheKey);
    if (stale?.data) {
      setRevenue(stale.data.revenue ?? null);
      setFunnel(stale.data.funnel ?? null);
      setHealth(stale.data.health ?? null);
      setSystem(stale.data.system ?? null);
      setLoading(false);
      if (stale.stale && token) fetchAll();
      return;
    }
    setLoading(true);
    fetchAll();
  }, [startDate, endDate, token, fetchAll]);

  const handleExport = async () => {
    if (!token) return;
    const params = new URLSearchParams({
      startDate: `${startDate}T00:00:00.000Z`,
      endDate: `${endDate}T23:59:59.999Z`,
    });
    const res = await fetch(`/api/admin/export/bookings?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookings-export.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading && !revenue && !funnel) {
    return <AdminAnalyticsSkeleton />;
  }

  const dateRangeLabel = `${startDate} → ${endDate}`;

  return (
    <div className="space-y-8">
      {/* Header: Title + Date range + Export */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Analytics</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Performance and revenue metrics for the selected period
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-xs font-medium text-slate-500">From</span>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="border-0 p-0 text-sm font-medium text-slate-900 bg-transparent focus:ring-0"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 shadow-sm">
            <span className="text-xs font-medium text-slate-500">To</span>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="border-0 p-0 text-sm font-medium text-slate-900 bg-transparent focus:ring-0"
            />
          </div>
          <button
            type="button"
            onClick={fetchAll}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-colors"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 transition-colors"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Executive summary: 4 key KPIs */}
      {revenue && funnel && (
        <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Key metrics · {dateRangeLabel}
          </h3>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total revenue"
              value={formatCurrency(revenue.totalRevenue)}
              subtext="Completed payments"
            />
            <KpiCard
              label="Conversion rate"
              value={formatPercent(funnel.conversionRate)}
              subtext="Bookings confirmed / attempts"
            />
            <KpiCard
              label="Payment success"
              value={formatPercent(revenue.paymentSuccessRate)}
              subtext="Successful payments"
            />
            <KpiCard
              label="Avg. booking value"
              value={formatCurrency(revenue.avgBookingValue)}
              subtext="Revenue per completed booking"
            />
          </div>
        </section>
      )}

      {/* Revenue & payments */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Revenue & payments</h3>
            <p className="text-sm text-slate-500 mt-0.5">Revenue over time and payment outcomes</p>
          </div>
        </div>
        {revenue ? (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
              <MetricCard label="Total revenue" value={formatCurrency(revenue.totalRevenue)} />
              <MetricCard label="Today" value={formatCurrency(revenue.revenueToday)} />
              <MetricCard label="This week" value={formatCurrency(revenue.revenueWeek)} />
              <MetricCard label="This month" value={formatCurrency(revenue.revenueMonth)} />
              <MetricCard
                label="Avg. booking value"
                value={formatCurrency(revenue.avgBookingValue)}
              />
              <MetricCard
                label="Payment success"
                value={formatPercent(revenue.paymentSuccessRate)}
                highlight
              />
              <MetricCard
                label="Failed payments"
                value={`${formatNumber(revenue.failedPayments)} (${formatPercent(revenue.failedPaymentsPct)})`}
              />
            </div>
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5">
                <h4 className="text-sm font-semibold text-slate-700 mb-4">Revenue trend</h4>
                {revenue.revenueTrend.length > 0 ? (
                  <div className="h-64">
                    <Line
                      data={{
                        labels: revenue.revenueTrend.map((t) => t.date),
                        datasets: [
                          {
                            label: 'Revenue (₹)',
                            data: revenue.revenueTrend.map((t) => t.revenue),
                            borderColor: CHART_COLORS.primary,
                            backgroundColor: CHART_COLORS.primaryLight,
                            fill: true,
                            tension: 0.3,
                            pointRadius: 4,
                            pointBackgroundColor: CHART_COLORS.primary,
                          },
                        ],
                      }}
                      options={{
                        ...chartDefaults,
                        scales: {
                          ...chartDefaults.scales,
                          y: {
                            ...chartDefaults.scales.y,
                            ticks: {
                              callback: (v) => (typeof v === 'number' ? `₹${v}` : v),
                            },
                          },
                        },
                      }}
                    />
                  </div>
                ) : (
                  <EmptyState message="No revenue data in this period" />
                )}
              </div>
              <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5">
                <h4 className="text-sm font-semibold text-slate-700 mb-4">Payment status</h4>
                {revenue.paymentStatusDistribution.length > 0 ? (
                  <div className="h-64">
                    <Bar
                      data={{
                        labels: revenue.paymentStatusDistribution.map((s) => s.status),
                        datasets: [
                          {
                            label: 'Count',
                            data: revenue.paymentStatusDistribution.map((s) => s.count),
                            backgroundColor: CHART_COLORS.neutral,
                            borderRadius: 6,
                          },
                        ],
                      }}
                      options={chartDefaults}
                    />
                  </div>
                ) : (
                  <EmptyState message="No payment data in this period" />
                )}
              </div>
            </div>
            <div className="mt-6 rounded-xl border border-slate-100 bg-slate-50/50 p-5">
              <h4 className="text-sm font-semibold text-slate-700 mb-4">
                Top businesses by revenue
              </h4>
              {revenue.revenueByBusiness.length > 0 ? (
                <div className="h-56">
                  <Bar
                    data={{
                      labels: revenue.revenueByBusiness.map(
                        (b) => b.name || b.business_id.slice(0, 8)
                      ),
                      datasets: [
                        {
                          label: 'Revenue (₹)',
                          data: revenue.revenueByBusiness.map((b) => b.revenue),
                          backgroundColor: CHART_COLORS.primary,
                          borderRadius: 6,
                        },
                      ],
                    }}
                    options={{
                      ...chartDefaults,
                      indexAxis: 'y' as const,
                      scales: {
                        ...chartDefaults.scales,
                        x: { ...chartDefaults.scales.x, beginAtZero: true },
                      },
                    }}
                  />
                </div>
              ) : (
                <EmptyState message="No revenue by business in this period" />
              )}
            </div>
          </>
        ) : (
          <EmptyState message="Revenue data unavailable" />
        )}
      </section>

      {/* Booking funnel */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Booking funnel</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            From request to confirmation — conversion and response metrics
          </p>
        </div>
        {funnel ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
            <MetricCard label="Attempts" value={formatNumber(funnel.attempts)} />
            <MetricCard label="Confirmed" value={formatNumber(funnel.confirmed)} highlight />
            <MetricCard label="Rejected" value={formatNumber(funnel.rejected)} />
            <MetricCard label="Cancelled" value={formatNumber(funnel.cancelled)} />
            <MetricCard label="Expired" value={formatNumber(funnel.expired)} />
            <MetricCard label="Conversion" value={formatPercent(funnel.conversionRate)} highlight />
            <MetricCard
              label="Avg. response (min)"
              value={funnel.avgTimeToAcceptMinutes.toFixed(1)}
            />
            <MetricCard label="Auto-expired" value={formatPercent(funnel.autoExpiredPct)} />
          </div>
        ) : (
          <EmptyState message="Funnel data unavailable" />
        )}
      </section>

      {/* Business health */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-slate-900">Business health</h3>
          <p className="text-sm text-slate-500 mt-0.5">
            Performance score by business (lowest first — focus on improvement)
          </p>
        </div>
        {health && health.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <table className="min-w-full divide-y divide-slate-200">
              <thead className="bg-slate-50">
                <tr>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Business
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Health score
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Acceptance
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Cancellation
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Payment success
                  </th>
                  <th className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Avg. response
                  </th>
                  <th className="px-5 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-600">
                    Revenue
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {health.map((row) => (
                  <tr key={row.business_id} className="hover:bg-slate-50/80 transition-colors">
                    <td className="px-5 py-4 text-sm font-medium text-slate-900">
                      {row.name || row.business_id.slice(0, 8)}
                    </td>
                    <td className="px-5 py-4">
                      <HealthScoreBar score={row.healthScore} />
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatPercent(row.acceptanceRate)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatPercent(row.cancellationRate)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {formatPercent(row.paymentSuccessRate)}
                    </td>
                    <td className="px-5 py-4 text-sm text-slate-600">
                      {row.avgResponseTimeMinutes.toFixed(1)} min
                    </td>
                    <td className="px-5 py-4 text-sm font-medium text-slate-900 text-right">
                      {formatCurrency(row.revenue)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState message="No business health data in this period" />
        )}
      </section>

      {/* System / technical */}
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h3 className="text-lg font-semibold text-slate-900">System & reliability</h3>
          <p className="text-sm text-slate-500 mt-0.5">API and background job health</p>
        </div>
        {system ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            <MetricCard label="Avg. response (ms)" value={formatNumber(system.avgResponseTimeMs)} />
            <MetricCard label="P95 latency (ms)" value={formatNumber(system.p95LatencyMs)} />
            <MetricCard label="Rate limit (429)" value={formatNumber(system.rateLimitHits429)} />
            <MetricCard label="Server errors (5xx)" value={formatNumber(system.failedCalls5xx)} />
            <MetricCard
              label="Cron last run"
              value={
                system.cronExpireBookingsLastRun
                  ? new Date(system.cronExpireBookingsLastRun).toLocaleString(undefined, {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })
                  : '—'
              }
            />
            <MetricCard
              label="Cron status"
              value={system.cronExpireBookingsOk ? 'OK' : 'Stale'}
              highlight={system.cronExpireBookingsOk}
            />
          </div>
        ) : (
          <EmptyState message="System metrics unavailable" />
        )}
      </section>
    </div>
  );
}

function KpiCard({ label, value, subtext }: { label: string; value: string; subtext: string }) {
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-1 text-xs text-slate-400">{subtext}</p>
    </div>
  );
}

function MetricCard({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        highlight ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-slate-50/50'
      }`}
    >
      <p className="text-xs font-medium text-slate-500 truncate">{label}</p>
      <p
        className={`mt-1 text-lg font-semibold truncate ${highlight ? 'text-emerald-800' : 'text-slate-900'}`}
        title={value}
      >
        {value}
      </p>
    </div>
  );
}

function HealthScoreBar({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  const color = pct >= 70 ? 'bg-emerald-500' : pct >= 40 ? 'bg-amber-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2 min-w-[100px]">
      <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-slate-700 w-8">{pct.toFixed(0)}</span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-slate-200 bg-slate-50/50 py-12 px-4 text-center">
      <p className="text-sm font-medium text-slate-500">{message}</p>
      <p className="mt-1 text-xs text-slate-400">Try a different date range</p>
    </div>
  );
}
