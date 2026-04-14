'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAnalyticsChartDayLabel } from '@/lib/utils/analytics-chart-format';

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v || 0);
}

function formatYAxisTick(v: number): string {
  if (v >= 100000) return `₹${(v / 100000).toFixed(v % 100000 === 0 ? 0 : 1)}L`;
  if (v >= 1000) return `₹${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}k`;
  return `₹${Math.round(v)}`;
}

const CHART_MARGIN = { top: 8, right: 4, left: 4, bottom: 0 };

export default function RevenueTrendChart({
  dailyData,
}: {
  dailyData: { date: string; revenue?: number; totalBookings: number }[];
}) {
  const chartData = useMemo(
    () => dailyData.map((d) => ({ ...d, revenue: d.revenue ?? 0 })),
    [dailyData]
  );

  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
      <h3 className="mb-1 text-sm font-semibold text-slate-900 md:mb-3">Revenue Over Time</h3>
      <p className="mb-3 text-xs text-slate-500 md:hidden">
        Daily revenue in the selected range (INR).
      </p>
      <div className="h-[220px] w-full min-w-0 md:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#334155" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#334155" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#e2e8f0' }}
              tickFormatter={formatAnalyticsChartDayLabel}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxisTick}
              width={36}
            />
            <Tooltip
              contentStyle={{ borderRadius: 10, borderColor: '#e2e8f0', fontSize: 12 }}
              formatter={(value) => [formatCurrency(value as number), 'Revenue']}
              labelFormatter={(label) =>
                typeof label === 'string' ? formatAnalyticsChartDayLabel(label) : String(label)
              }
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="#334155"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
