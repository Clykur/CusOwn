'use client';

import { useState, useEffect, useCallback } from 'react';
import SuccessMetricsDashboardSkeleton from '@/components/admin/success-metrics-dashboard.skeleton';
import { useAdminSession } from '@/components/admin/admin-session-context';
import { adminFetch } from '@/lib/utils/admin-fetch.client';
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
      className={`rounded-xl border p-5 ${
        pass === true
          ? 'border-emerald-200 bg-emerald-50/60'
          : pass === false
            ? 'border-red-200 bg-red-50/60'
            : 'border-slate-200 bg-slate-50/50'
      }`}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p
        className={`mt-2 text-2xl font-bold tracking-tight ${
          pass === true ? 'text-emerald-800' : pass === false ? 'text-red-800' : 'text-slate-900'
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-xs text-slate-500">{subtext}</p>
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
      if (!token && !backgroundRevalidate) {
        setLoading(false);
        return;
      }
      if (!backgroundRevalidate) setLoading(true);
      try {
        const url = `/api/metrics/success?start_date=${startDate}&end_date=${endDate}&include_alerts=true`;
        const response = token
          ? await adminFetch(url, { token, credentials: 'include' })
          : await fetch(url, { credentials: 'include' });
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
      if (token) fetchMetrics(true);
      return;
    }
    const stale = getAdminCachedStale<CachedMetrics>(key);
    if (stale?.data?.technical && stale?.data?.business) {
      setTechnical(stale.data.technical);
      setBusiness(stale.data.business);
      setThresholds(stale.data.thresholds || []);
      setLoading(false);
      if (token) fetchMetrics(true);
      return;
    }
    fetchMetrics(false);
  }, [startDate, endDate, token, fetchMetrics]);

  if (loading && !technical && !business) {
    return <SuccessMetricsDashboardSkeleton />;
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Success metrics</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Technical and business KPIs for the selected period
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
            onClick={() => fetchMetrics(false)}
            className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-slate-800 transition-colors"
          >
            Apply
          </button>
        </div>
      </div>

      {/* Technical metrics */}
      {technical && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Technical metrics</h3>
            <p className="text-sm text-slate-500 mt-0.5">
              API, uptime, errors and database performance
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="API response (p95)"
              value={`${technical.apiResponseTimeP95}ms`}
              subtext="Target: &lt;200ms"
              pass={technical.apiResponseTimeP95 <= 200}
            />
            <MetricCard
              label="Uptime"
              value={`${technical.uptime.toFixed(2)}%`}
              subtext="Target: &gt;99.9%"
              pass={technical.uptime >= 99.9}
            />
            <MetricCard
              label="Error rate"
              value={`${technical.errorRate.toFixed(3)}%`}
              subtext="Target: &lt;0.1%"
              pass={technical.errorRate <= 0.1}
            />
            <MetricCard
              label="DB query (p95)"
              value={`${technical.dbQueryTimeP95}ms`}
              subtext="Target: &lt;100ms"
              pass={technical.dbQueryTimeP95 <= 100}
            />
          </div>
        </section>
      )}

      {/* Business metrics */}
      {business && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Business metrics</h3>
            <p className="text-sm text-slate-500 mt-0.5">
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
              subtext="Target: &lt;10%"
              pass={business.noShowRate <= 10}
            />
            <MetricCard
              label="Owner retention"
              value={`${business.ownerRetention.toFixed(2)}%`}
              subtext="Target: &gt;80%"
              pass={business.ownerRetention >= 80}
            />
            <MetricCard
              label="Completion rate"
              value={`${business.bookingCompletionRate.toFixed(2)}%`}
              subtext="Target: &gt;90%"
              pass={business.bookingCompletionRate >= 90}
            />
          </div>
        </section>
      )}

      {/* Threshold status */}
      {thresholds.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-slate-900">Threshold status</h3>
            <p className="text-sm text-slate-500 mt-0.5">Pass / fail against targets</p>
          </div>
          <div className="space-y-2">
            {thresholds.map((t) => (
              <div
                key={t.metric}
                className={`flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 rounded-xl px-4 py-3 ${
                  t.status === 'pass'
                    ? 'bg-emerald-50 border border-emerald-200'
                    : 'bg-red-50 border border-red-200'
                }`}
              >
                <div className="min-w-0">
                  <span className="font-medium text-slate-900">{t.metric}</span>
                  {t.reason && (
                    <p
                      className={`mt-0.5 text-sm ${t.status === 'pass' ? 'text-emerald-700' : 'text-red-700'}`}
                    >
                      {t.reason}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-4 flex-shrink-0">
                  <span className={t.status === 'pass' ? 'text-emerald-700' : 'text-red-700'}>
                    {t.value} / {t.threshold}
                  </span>
                  <span
                    className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
                      t.status === 'pass'
                        ? 'bg-emerald-200 text-emerald-800'
                        : 'bg-red-200 text-red-800'
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
        <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-12 text-center">
          <p className="text-sm font-medium text-slate-500">No metrics available</p>
          <p className="mt-1 text-xs text-slate-400">Try a different date range</p>
        </section>
      )}
    </div>
  );
}
