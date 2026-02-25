'use client';

import React, { useMemo } from 'react';

function LineChart({
  data,
  color = '#111827',
}: {
  data: { x: string; y: number }[];
  color?: string;
}) {
  const w = 600;
  const h = 160;
  const safeData =
    data && data.length > 0 ? data : Array.from({ length: 7 }).map((_, i) => ({ x: `${i}`, y: 0 }));
  const values = safeData.map((d) => d.y);
  const max = Math.max(...values, 1);
  const step = w / Math.max(1, safeData.length - 1);
  const points = safeData.map((d, i) => `${i * step},${h - (d.y / max) * (h - 12)}`).join(' ');
  return (
    <div className="w-full min-w-0">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-40"
        width="100%"
        height={h}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* horizontal baseline */}
        <line x1={0} y1={h - 12} x2={w} y2={h - 12} stroke="#e5e7eb" strokeWidth={1} />
        <polyline
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {(!data || data.length === 0) && (
        <div className="text-xs text-gray-500 mt-2">Bookings (0)</div>
      )}
    </div>
  );
}

function AreaChart({ data }: { data: { x: string; y: number }[] }) {
  const w = 600;
  const h = 160;
  const safeData =
    data && data.length > 0 ? data : Array.from({ length: 7 }).map((_, i) => ({ x: `${i}`, y: 0 }));
  const values = safeData.map((d) => d.y);
  const max = Math.max(...values, 1);
  const step = w / Math.max(1, safeData.length - 1);
  const points = safeData.map((d, i) => `${i * step},${h - (d.y / max) * (h - 12)}`).join(' L ');
  const dAttr = `M0,${h} L ${points} L ${w},${h} Z`;
  return (
    <div className="w-full min-w-0">
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-40"
        width="100%"
        height={h}
        preserveAspectRatio="xMidYMid meet"
      >
        <line x1={0} y1={h - 12} x2={w} y2={h - 12} stroke="#e5e7eb" strokeWidth={1} />
        <path d={dAttr} fill="rgba(0,0,0,0.06)" />
        <polyline
          points={points}
          fill="none"
          stroke="#0f766e"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {(!data || data.length === 0) && (
        <div className="text-xs text-gray-500 mt-2">Revenue (0)</div>
      )}
    </div>
  );
}

function Donut({ parts }: { parts: { label: string; value: number; color?: string }[] }) {
  const total = parts && parts.length > 0 ? parts.reduce((s, p) => s + p.value, 0) : 0;
  const hasValues = total > 0;
  const safeParts = hasValues ? parts : [{ label: 'No data', value: 1, color: '#d1d5db' }];
  let angle = 0;
  const cx = 50;
  const cy = 50;
  const r = 40;
  const circumference = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 100 100" className="w-36 h-36">
      {safeParts.map((p, i) => {
        const frac = p.value / (hasValues ? total : 1);
        const dash = frac * circumference;
        const rotation = (angle / (hasValues ? total : 1)) * 360;
        angle += p.value;
        return (
          <circle
            key={i}
            r={r}
            cx={cx}
            cy={cy}
            fill="none"
            stroke={p.color || '#111827'}
            strokeWidth={10}
            strokeDasharray={`${dash} ${circumference - dash}`}
            transform={`rotate(${rotation} ${cx} ${cy})`}
            strokeLinecap="butt"
          />
        );
      })}
      {!hasValues && (
        <text x="50" y="55" textAnchor="middle" className="text-xs" fill="#6b7280">
          0
        </text>
      )}
    </svg>
  );
}

export default function TrendCharts({
  dailyData,
  peakHours,
  services,
  analytics,
}: {
  dailyData: any[];
  peakHours: any[];
  services?: any[];
  analytics?: { confirmedBookings?: number; rejectedBookings?: number; cancelledBookings?: number };
}) {
  const bookingsSeries = useMemo(
    () =>
      dailyData && dailyData.length
        ? dailyData.map((d) => ({ x: d.date, y: d.totalBookings }))
        : [],
    [dailyData]
  );
  const revenueSeries = useMemo(
    () =>
      dailyData && dailyData.length ? dailyData.map((d) => ({ x: d.date, y: d.revenue ?? 0 })) : [],
    [dailyData]
  );
  const peak = useMemo(
    () =>
      peakHours && peakHours.length
        ? peakHours.map((p) => ({ label: `${p.hour}:00`, value: p.bookingCount }))
        : [],
    [peakHours]
  );
  const servicesSorted = useMemo(
    () => (services && services.length ? services.slice(0, 8) : []),
    [services]
  );
  const statusParts = useMemo(() => analyticsParts(analytics), [analytics]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="col-span-2 bg-white p-5 rounded-xl border border-slate-200 shadow-sm min-w-0">
        <h3 className="text-sm font-semibold mb-2 text-slate-900">Bookings Over Time</h3>
        <div className="min-h-[160px] min-w-0">
          <LineChart data={bookingsSeries} color="#111827" />
        </div>

        <h3 className="text-sm font-semibold mt-5 mb-2 text-slate-900">Revenue Over Time</h3>
        <div className="min-h-[160px] min-w-0">
          <AreaChart data={revenueSeries} />
        </div>
      </div>

      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm min-w-0">
        <h3 className="text-sm font-semibold mb-3 text-slate-900">Booking Status</h3>
        <div className="flex items-center justify-center">
          <Donut parts={statusParts} />
        </div>
        <div className="mt-3 space-y-1.5">
          {statusParts.map((p, idx) => (
            <div
              key={`${p.label}-${idx}`}
              className="flex items-center justify-between text-xs text-slate-600"
            >
              <div className="flex items-center gap-2">
                <span
                  className="inline-block h-2.5 w-2.5 rounded-full"
                  style={{ background: p.color || '#111827' }}
                />
                <span>{p.label}</span>
              </div>
              <span className="font-medium text-slate-800">{p.value}</span>
            </div>
          ))}
        </div>

        <h3 className="text-sm font-semibold mt-5 mb-2 text-slate-900">Peak Hours</h3>
        <div className="space-y-2">
          {(peak.length ? peak : peakPlaceholder()).map((p, i) => (
            <div key={i} className="flex items-center gap-2 min-w-0">
              <div className="w-12 text-sm text-gray-700">{p.label}</div>
              <div className="flex-1 bg-gray-100 rounded h-3 min-w-0">
                <div
                  className="bg-black h-3 rounded"
                  style={{
                    width: `${(p.value / Math.max(...peak.map((x: any) => x.value), 1)) * 100}%`,
                  }}
                />
              </div>
              <div className="w-8 text-right text-sm">{p.value}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="col-span-1 lg:col-span-3">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm min-w-0">
          <h3 className="text-sm font-semibold mb-3 text-slate-900">Service Popularity</h3>
          <div className="space-y-2">
            {(servicesSorted.length ? servicesSorted : servicesPlaceholder()).map(
              (s: any, i: number) => (
                <div key={i} className="flex items-center gap-3 min-w-0">
                  <div className="w-48 text-sm text-gray-700">{s.name}</div>
                  <div className="flex-1 bg-gray-100 rounded h-3 min-w-0">
                    <div
                      className="bg-black h-3 rounded"
                      style={{
                        width: `${
                          (s.count /
                            Math.max(
                              1,
                              servicesSorted.reduce((a: any, b: any) => Math.max(a, b.count), 0)
                            )) *
                          100
                        }%`,
                      }}
                    />
                  </div>
                  <div className="w-8 text-right text-sm">{s.count}</div>
                </div>
              )
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// helpers for placeholders
function peakPlaceholder() {
  return Array.from({ length: 6 }).map((_, i) => ({ label: `${8 + i}:00`, value: 0 }));
}

function servicesPlaceholder() {
  return Array.from({ length: 6 }).map((_, i) => ({ name: `Service ${i + 1}`, count: 0 }));
}

function analyticsParts(analytics?: {
  confirmedBookings?: number;
  rejectedBookings?: number;
  cancelledBookings?: number;
}) {
  const confirmed = analytics?.confirmedBookings ?? 0;
  const rejected = analytics?.rejectedBookings ?? 0;
  const cancelled = analytics?.cancelledBookings ?? 0;
  return [
    { label: 'Confirmed', value: confirmed, color: '#10b981' },
    { label: 'Rejected', value: rejected, color: '#6b7280' },
    { label: 'Cancelled', value: cancelled, color: '#f59e0b' },
  ];
}
