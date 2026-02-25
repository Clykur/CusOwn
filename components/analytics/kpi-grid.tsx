'use client';

import React, { useMemo } from 'react';
import { formatDate } from '@/lib/utils/string';

function SmallSparkline({ values }: { values: number[] }) {
  const w = 120;
  const h = 28;
  const safeValues = values && values.length > 0 ? values : [0, 0, 0, 0, 0];
  const max = Math.max(...safeValues, 1);
  const step = w / Math.max(1, safeValues.length - 1);
  const path = safeValues.map((v, i) => `${i * step},${h - (v / max) * (h - 4)}`).join(' ');
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full h-8"
      width="100%"
      height={h}
      preserveAspectRatio="xMidYMid meet"
    >
      <line x1={0} y1={h - 4} x2={w} y2={h - 4} stroke="#eef2f7" strokeWidth={1} />
      <polyline
        points={path}
        fill="none"
        stroke="#111827"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MetricCard({
  title,
  value,
  change,
  spark,
}: {
  title: string;
  value: React.ReactNode;
  change?: number | null;
  spark?: number[];
}) {
  const positive = typeof change === 'number' ? change >= 0 : null;
  return (
    <div className="h-32 rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md flex flex-col justify-between">
      <div className="flex justify-between items-start">
        <div>
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500">{title}</div>
          <div className="mt-1 text-2xl font-bold text-slate-900">{value}</div>
        </div>
        <div className="text-right">
          {typeof change === 'number' ? (
            <div
              className={`text-sm font-semibold ${positive ? 'text-emerald-600' : 'text-rose-600'}`}
            >
              {positive ? '▲' : '▼'} {Math.abs(change)}%
            </div>
          ) : (
            <div className="text-xs text-slate-400">—</div>
          )}
        </div>
      </div>
      <div className="mt-2">
        <SmallSparkline values={spark || []} />
      </div>
    </div>
  );
}

export default function KPIGrid({
  analytics,
  dailyData,
  retention,
}: {
  analytics: any;
  dailyData: any[];
  retention?: any[] | null;
}) {
  const values = useMemo(() => dailyData.map((d) => d.totalBookings), [dailyData]);

  const total = analytics?.totalBookings ?? 0;
  const confirmed = analytics?.confirmedBookings ?? 0;
  const conversion = analytics?.conversionRate ?? null;
  const noshow = analytics?.noShowRate ?? null;
  const cancelled = analytics?.cancellationRate ?? null;

  // week-over-week placeholder change using last 7 vs prev 7
  const change = useMemo(() => {
    if (dailyData.length < 14) return null;
    const last7 = dailyData.slice(-7).reduce((s, d) => s + d.totalBookings, 0);
    const prev7 = dailyData.slice(-14, -7).reduce((s, d) => s + d.totalBookings, 0);
    if (prev7 === 0) return null;
    return Math.round(((last7 - prev7) / prev7) * 100 * 100) / 100;
  }, [dailyData]);

  const returningPct = useMemo(() => {
    if (!retention || retention.length === 0) return null;
    const returning = retention.filter((r: any) => r.totalBookings > 1).length;
    const totalCustomers = retention.length;
    return Math.round((returning / Math.max(1, totalCustomers)) * 100 * 100) / 100;
  }, [retention]);

  const avgPerDay = useMemo(() => {
    const days = Math.max(1, dailyData.length);
    const totalBookings = dailyData.reduce((s, d) => s + d.totalBookings, 0);
    return Math.round((totalBookings / days) * 100) / 100;
  }, [dailyData]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <MetricCard title="Total Bookings" value={total} change={change} spark={values} />
      <MetricCard title="Confirmed" value={confirmed} change={change} spark={values} />
      <MetricCard
        title="Conversion"
        value={conversion != null ? `${conversion}%` : '—'}
        change={change}
        spark={values}
      />
      <MetricCard
        title="No Show Rate"
        value={noshow != null ? `${noshow}%` : '—'}
        change={change}
        spark={values}
      />
      <MetricCard
        title="Cancelled Rate"
        value={cancelled != null ? `${cancelled}%` : '—'}
        change={change}
        spark={values}
      />
      <MetricCard
        title="Returning %"
        value={returningPct != null ? `${returningPct}%` : '—'}
        change={null}
        spark={values}
      />
      <MetricCard title="Avg / Day" value={avgPerDay} change={null} spark={values} />
      <MetricCard
        title="Peak Hour"
        value={analytics?.peakHour ?? '—'}
        change={null}
        spark={values}
      />
    </div>
  );
}
