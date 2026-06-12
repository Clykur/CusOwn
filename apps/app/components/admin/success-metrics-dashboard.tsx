'use client';

import { useState, useEffect, useCallback } from 'react';
import SuccessMetricsDashboardSkeleton from '@/components/admin/success-metrics-dashboard.skeleton';
import { useAdminSession } from '@/components/admin/admin-session-context';
import { adminFetch } from '@cusown/shared';
import DateFilter from '@/components/owner/date-filter';
import {
  getSuccessMetricsCacheKey,
  getAdminCached,
  getAdminCachedStale,
  setAdminCache,
} from '@/components/admin/admin-cache';

interface TechnicalMetrics {
  apiResponseTimeP95: number;
  uptime: number;
  errorRate: number;
  dbQueryTimeP95: number;
}

interface BusinessMetrics {
  supportQueriesReduction: number;
  noShowRate: number;
  ownerRetention: number;
  bookingCompletionRate: number;
}

interface Threshold {
  metric: string;
  status: 'pass' | 'fail';
  value: number;
  threshold: number;
  reason?: string;
}

function MetricCard({
  label,
  value,
  subtext,
  pass,
}: {
  label: string;
  value: string;
  subtext: string;
  pass?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 ${
        pass === true
          ? 'border-emerald-500/30 bg-emerald-950/20 hover:border-emerald-500/50 hover:shadow-[0_0_12px_rgba(34,197,94,0.06)]'
          : pass === false
            ? 'border-red-500/30 bg-red-950/20 hover:border-red-500/50 hover:shadow-[0_0_12px_rgba(239,68,68,0.06)]'
            : 'border-border-primary bg-surface-card hover:border-[#00E676]/45 hover:shadow-[0_0_12px_rgba(0,230,118,0.06)]'
      }`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary font-mono">
        {label}
      </p>
      <p
        className={`mt-2 text-2xl font-bold tracking-tight font-display ${
          pass === true ? 'text-emerald-400' : pass === false ? 'text-red-400' : 'text-text-primary'
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-text-tertiary font-mono">{subtext}</p>
    </div>
  );
}

type CachedMetrics = {
  technical: TechnicalMetrics;
  business: BusinessMetrics;
  thresholds: Threshold[];
};

export default function SuccessMetricsDashboard() {
  const { token } = useAdminSession();
  const [loading, setLoading] = useState(true);
  const [technical, setTechnical] = useState<TechnicalMetrics | null>(null);
  const [business, setBusiness] = useState<BusinessMetrics | null>(null);
  const [thresholds, setThresholds] = useState<Threshold[]>([]);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 30);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);

  const applyResult = useCallback(
    (result: {
      metrics?: { technical?: TechnicalMetrics; business?: BusinessMetrics };
      thresholds?: Threshold[];
    }) => {
      if (result.metrics?.technical) setTechnical(result.metrics.technical);
      if (result.metrics?.business) setBusiness(result.metrics.business);
      if (Array.isArray(result.thresholds)) setThresholds(result.thresholds);
    },
    []
  );

  const fetchMetrics = useCallback(
    async (backgroundRevalidate = false) => {
      if (!backgroundRevalidate) setLoading(true);
      try {
        const url = `/api/metrics/success?start_date=${startDate}&end_date=${endDate}&include_alerts=true`;
        const response = await adminFetch(url, {
          ...(token ? { token } : {}),
          credentials: 'include',
        });
        if (response.ok) {
          const result = await response.json();
          if (result.success && result.data) {
            applyResult(result.data);
            const key = getSuccessMetricsCacheKey(startDate, endDate);
            setAdminCache(key, {
              technical: result.data.metrics?.technical,
              business: result.data.metrics?.business,
              thresholds: result.data.thresholds || [],
            });
          }
        }
      } catch (error) {
        if (!backgroundRevalidate) console.error('Failed to fetch metrics:', error);
      } finally {
        if (!backgroundRevalidate) setLoading(false);
      }
    },
    [startDate, endDate, token, applyResult]
  );

  useEffect(() => {
    const key = getSuccessMetricsCacheKey(startDate, endDate);
    const cached = getAdminCached<CachedMetrics>(key);
    if (cached?.technical && cached?.business) {
      setTechnical(cached.technical);
      setBusiness(cached.business);
      setThresholds(cached.thresholds || []);
      setLoading(false);
      fetchMetrics(true);
      return;
    }
    const stale = getAdminCachedStale<CachedMetrics>(key);
    if (stale?.data?.technical && stale?.data?.business) {
      setTechnical(stale.data.technical);
      setBusiness(stale.data.business);
      setThresholds(stale.data.thresholds || []);
      setLoading(false);
      fetchMetrics(true);
      return;
    }
    fetchMetrics(false);
  }, [startDate, endDate, fetchMetrics]);

  if (loading && !technical && !business) {
    return <SuccessMetricsDashboardSkeleton />;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-text-primary tracking-tight font-display">
            Success metrics
          </h2>
          <p className="text-xs text-text-secondary mt-1">
            Technical and business KPIs for the selected period
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
            onClick={() => fetchMetrics(false)}
            className="h-11 rounded-xl bg-brand-primary px-5 text-sm font-bold text-background-primary shadow-sm hover:bg-brand-primaryHover active:bg-brand-primaryPressed transition-all duration-150 cursor-pointer"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Technical metrics */}
      {technical && (
        <section className="rounded-xl border border-border-primary bg-surface-card p-6">
          <div className="mb-6">
            <h3 className="text-base font-bold text-text-primary font-display">
              Technical metrics
            </h3>
            <p className="text-xs text-text-secondary mt-1">
              API, uptime, errors and database performance
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="API response (p95)"
              value={`${technical.apiResponseTimeP95}ms`}
              subtext="Target: <200ms"
              pass={technical.apiResponseTimeP95 <= 200}
            />
            <MetricCard
              label="Uptime"
              value={`${technical.uptime.toFixed(2)}%`}
              subtext="Target: >99.9%"
              pass={technical.uptime >= 99.9}
            />
            <MetricCard
              label="Error rate"
              value={`${technical.errorRate.toFixed(3)}%`}
              subtext="Target: <0.1%"
              pass={technical.errorRate <= 0.1}
            />
            <MetricCard
              label="DB query (p95)"
              value={`${technical.dbQueryTimeP95}ms`}
              subtext="Target: <100ms"
              pass={technical.dbQueryTimeP95 <= 100}
            />
          </div>
        </section>
      )}

      {/* Business metrics */}
      {business && (
        <section className="rounded-xl border border-border-primary bg-surface-card p-6">
          <div className="mb-6">
            <h3 className="text-base font-bold text-text-primary font-display">Business metrics</h3>
            <p className="text-xs text-text-secondary mt-1">
              Support, no-shows, retention and completion
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Support reduction"
              value={`${business.supportQueriesReduction.toFixed(1)}%`}
              subtext="Target: 60%"
            />
            <MetricCard
              label="No-show rate"
              value={`${business.noShowRate.toFixed(2)}%`}
              subtext="Target: <10%"
              pass={business.noShowRate <= 10}
            />
            <MetricCard
              label="Owner retention"
              value={`${business.ownerRetention.toFixed(2)}%`}
              subtext="Target: >80%"
              pass={business.ownerRetention >= 80}
            />
            <MetricCard
              label="Completion rate"
              value={`${business.bookingCompletionRate.toFixed(2)}%`}
              subtext="Target: >90%"
              pass={business.bookingCompletionRate >= 90}
            />
          </div>
        </section>
      )}

      {/* Threshold status */}
      {thresholds.length > 0 && (
        <section className="rounded-xl border border-border-primary bg-surface-card p-6">
          <div className="mb-6">
            <h3 className="text-base font-bold text-text-primary font-display">Threshold status</h3>
            <p className="text-xs text-text-secondary mt-1">Pass / fail against targets</p>
          </div>
          <div className="space-y-2">
            {thresholds.map((t) => (
              <div
                key={t.metric}
                className={`flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 rounded-xl px-4 py-3 border ${
                  t.status === 'pass'
                    ? 'bg-emerald-950/20 border-emerald-500/30'
                    : 'bg-red-950/20 border-red-500/30'
                }`}
              >
                <div className="min-w-0">
                  <span className="font-semibold text-text-primary font-mono text-sm">
                    {t.metric}
                  </span>
                  {t.reason && (
                    <p
                      className={`mt-0.5 text-xs ${t.status === 'pass' ? 'text-emerald-400' : 'text-red-400'}`}
                    >
                      {t.reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span
                    className={`text-sm font-mono ${t.status === 'pass' ? 'text-emerald-400' : 'text-red-400'}`}
                  >
                    {t.value} / {t.threshold}
                  </span>
                  <span
                    className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wide border ${
                      t.status === 'pass'
                        ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-400'
                        : 'bg-red-950/40 border-red-500/40 text-red-400'
                    }`}
                  >
                    {t.status === 'pass' ? 'PASS' : 'FAIL'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {!technical && !business && thresholds.length === 0 && (
        <section className="rounded-xl border border-dashed border-border-primary bg-background-secondary/10 p-12 text-center">
          <p className="text-sm font-semibold text-text-secondary">No metrics available</p>
          <p className="mt-1 text-xs text-text-tertiary font-mono">Try a different date range</p>
        </section>
      )}
    </div>
  );
}
