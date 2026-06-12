'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAdminSession } from '@/components/admin/admin-session-context';
import {
  getAdminCached,
  getAdminCachedStale,
  setAdminCache,
  getAdminAnalyticsCacheKey,
} from '@/components/admin/admin-cache';
import { adminFetch } from '@cusown/shared';
import DateFilter from '@/components/owner/date-filter';
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
} from '@cusown/shared';
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
  primary: '#00E676',
  primaryLight: 'rgba(0, 230, 118, 0.12)',
  secondary: '#0F3D2E',
  secondaryLight: 'rgba(15, 61, 46, 0.08)',
  success: '#22C55E',
  warning: '#F59E0B',
  danger: '#FF5C5C',
  neutral: ['#00E676', '#145541', '#A1A1A1', '#737373'],
};

const chartDefaults = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: 'top' as const,
      labels: { usePointStyle: true, padding: 16, color: '#A1A1A1' },
    },
    tooltip: {
      backgroundColor: '#161616',
      borderColor: '#2A2A2A',
      borderWidth: 1,
      padding: 12,
      titleFont: { size: 13, family: 'var(--font-space-grotesk)' },
      bodyFont: { size: 12 },
      titleColor: '#F5F5F5',
      bodyColor: '#A1A1A1',
    },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        maxRotation: 45,
        font: { size: 11, family: 'var(--font-space-grotesk)' },
        color: '#A1A1A1',
      },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(42, 42, 42, 0.4)' },
      ticks: { font: { size: 11, family: 'var(--font-space-grotesk)' }, color: '#A1A1A1' },
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
    <div className="space-y-6">
      {/* Header: Title + Date range + Export */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight font-display">
            Analytics
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Performance and revenue metrics for the selected period
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <div className="w-[180px]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
              From
            </label>
            <DateFilter value={startDate} onChange={setStartDate} />
          </div>
          <div className="w-[180px]">
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
              To
            </label>
            <DateFilter value={endDate} onChange={setEndDate} />
          </div>
          <button
            type="button"
            onClick={fetchAll}
            className="h-11 rounded-xl bg-brand-primary px-5 text-sm font-bold text-background-primary shadow-sm hover:bg-brand-primaryHover active:bg-brand-primaryPressed transition-all duration-150 cursor-pointer"
          >
            Apply
          </button>
          <button
            type="button"
            onClick={handleExport}
            className="h-11 rounded-xl border border-border-primary bg-background-tertiary px-5 text-sm font-bold text-text-primary hover:border-[#00E676]/40 hover:bg-background-secondary transition-all duration-150 cursor-pointer"
          >
            Export CSV
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-red-500/20 bg-red-950/10 px-4 py-3 text-sm text-state-error font-mono">
          {error}
        </div>
      )}

      {/* Executive summary: 4 key KPIs */}
      {revenue && funnel && (
        <section className="rounded-xl border border-border-primary bg-surface-card p-6">
          <h3 className="text-[10px] font-bold uppercase tracking-wider text-text-secondary font-mono mb-4">
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
      <section className="rounded-xl border border-border-primary bg-surface-card p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-bold text-text-primary font-display">
              Revenue & payments
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              Revenue over time and payment outcomes
            </p>
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
              <div className="rounded-xl border border-border-primary bg-[#0A0A0A]/40 p-5">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider font-mono mb-4">
                  Revenue trend
                </h4>
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
                              color: '#A1A1A1',
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
              <div className="rounded-xl border border-border-primary bg-[#0A0A0A]/40 p-5">
                <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider font-mono mb-4">
                  Payment status
                </h4>
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
            <div className="mt-6 rounded-xl border border-border-primary bg-[#0A0A0A]/40 p-5">
              <h4 className="text-xs font-bold text-text-secondary uppercase tracking-wider font-mono mb-4">
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
      <section className="rounded-xl border border-border-primary bg-surface-card p-6">
        <div className="mb-6">
          <h3 className="text-base font-bold text-text-primary font-display">Booking funnel</h3>
          <p className="text-xs text-text-secondary mt-1">
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
      <section className="rounded-xl border border-border-primary bg-surface-card p-6">
        <div className="mb-6">
          <h3 className="text-base font-bold text-text-primary font-display">Business health</h3>
          <p className="text-xs text-text-secondary mt-1">
            Performance score by business (lowest first — focus on improvement)
          </p>
        </div>
        {health && health.length > 0 ? (
          <div className="overflow-hidden rounded-xl border border-border-primary bg-background-secondary/20">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-border-primary">
                <thead className="bg-[#0F3D2E]/20">
                  <tr>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Business
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Health score
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Acceptance
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Cancellation
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Payment success
                    </th>
                    <th className="px-5 py-3 text-left text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Avg. response
                    </th>
                    <th className="px-5 py-3 text-right text-[10px] font-bold uppercase tracking-wider text-[#00E676] font-mono">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary/45 bg-transparent">
                  {health.map((row) => (
                    <tr
                      key={row.business_id}
                      className="hover:bg-[#181818]/60 transition-colors border-b border-border-primary/45 bg-transparent"
                    >
                      <td className="px-5 py-4 text-sm font-semibold text-text-primary">
                        {row.name || row.business_id.slice(0, 8)}
                      </td>
                      <td className="px-5 py-4 whitespace-nowrap">
                        <HealthScoreBar score={row.healthScore} />
                      </td>
                      <td className="px-5 py-4 text-sm text-text-secondary font-mono">
                        {formatPercent(row.acceptanceRate)}
                      </td>
                      <td className="px-5 py-4 text-sm text-text-secondary font-mono">
                        {formatPercent(row.cancellationRate)}
                      </td>
                      <td className="px-5 py-4 text-sm text-text-secondary font-mono">
                        {formatPercent(row.paymentSuccessRate)}
                      </td>
                      <td className="px-5 py-4 text-sm text-text-secondary font-mono">
                        {row.avgResponseTimeMinutes.toFixed(1)} min
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-[#00E676] text-right font-mono">
                        {formatCurrency(row.revenue)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <EmptyState message="No business health data in this period" />
        )}
      </section>

      {/* System / technical */}
      <section className="rounded-xl border border-border-primary bg-surface-card p-6">
        <div className="mb-6">
          <h3 className="text-base font-bold text-text-primary font-display">
            System & reliability
          </h3>
          <p className="text-xs text-text-secondary mt-1">API and background job health</p>
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
    <div className="rounded-xl border border-border-primary bg-surface-card p-5 hover:border-[#00E676]/40 hover:shadow-[0_0_12px_rgba(0,230,118,0.06)] hover:-translate-y-0.5 transition-all duration-200 ease-out select-none">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary font-mono">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-text-primary font-display">
        {value}
      </p>
      <p className="mt-1 text-xs text-text-tertiary font-mono">{subtext}</p>
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
      className={`rounded-xl border p-4 transition-all duration-200 ease-out hover:-translate-y-0.5 select-none ${
        highlight
          ? 'border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-500/50 hover:shadow-[0_0_12px_rgba(34,197,94,0.06)]'
          : 'border-border-primary bg-surface-card hover:border-[#00E676]/40 hover:shadow-[0_0_12px_rgba(0,230,118,0.06)]'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary font-mono truncate">
        {label}
      </p>
      <p
        className={`mt-1.5 text-base font-bold font-mono tracking-tight truncate ${highlight ? 'text-emerald-400' : 'text-text-primary'}`}
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
      <div className="flex-1 h-2 rounded-full bg-border-primary overflow-hidden">
        <div
          className={`h-full rounded-full ${color} transition-all`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-text-primary font-mono w-8">
        {pct.toFixed(0)}
      </span>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border-primary bg-background-secondary/10 py-12 px-4 text-center">
      <p className="text-sm font-semibold text-text-secondary">{message}</p>
      <p className="mt-1 text-xs text-text-tertiary font-mono">Try a different date range</p>
    </div>
  );
}
