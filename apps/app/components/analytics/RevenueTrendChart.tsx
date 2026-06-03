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
import { formatAnalyticsChartDayLabel } from '@cusown/shared';
import { colors } from '@/lib/theme/colors';

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
    <div className="min-w-0 overflow-hidden rounded-xl border border-border-primary bg-surface-card p-4 shadow-sm md:p-6">
      <h3 className="mb-1 text-sm font-semibold text-text-primary md:mb-3">Revenue Over Time</h3>
      <p className="mb-3 text-xs text-text-secondary md:hidden">
        Daily revenue in the selected range (INR).
      </p>
      <div className="h-[220px] w-full min-w-0 md:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={CHART_MARGIN}>
            <defs>
              <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={colors.brand.primary} stopOpacity={0.25} />
                <stop offset="95%" stopColor={colors.brand.primary} stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.primary} vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              tick={{
                fontSize: 10,
                fill: colors.text.secondary,
              }}
              axisLine={{
                stroke: colors.border.primary,
              }}
              tickFormatter={formatAnalyticsChartDayLabel}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              tick={{
                fontSize: 10,
                fill: colors.text.secondary,
              }}
              tickLine={false}
              axisLine={false}
              tickFormatter={formatYAxisTick}
              width={36}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                borderColor: colors.border.primary,
                backgroundColor: colors.surface.modal,
                color: colors.text.primary,
                fontSize: 12,
              }}
              formatter={(value) => [formatCurrency(value as number), 'Revenue']}
              labelFormatter={(label) =>
                typeof label === 'string' ? formatAnalyticsChartDayLabel(label) : String(label)
              }
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke={colors.brand.primary}
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#revenueGradient)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
