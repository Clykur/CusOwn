'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatAnalyticsChartDayLabel } from '@cusown/shared';
import { colors } from '@/lib/theme/colors';

const CHART_MARGIN = { top: 8, right: 4, left: 0, bottom: 0 };

export default function BookingTrendChart({
  dailyData,
}: {
  dailyData: { date: string; totalBookings: number; revenue?: number }[];
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-border-primary bg-surface-card p-4 shadow-sm md:p-6">
      <h3 className="mb-1 text-sm font-semibold text-text-primary md:mb-3">Bookings Over Time</h3>
      <p className="mb-3 text-xs text-text-secondary md:hidden">
        Daily booking count in the selected range.
      </p>
      <div className="h-[220px] w-full min-w-0 md:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dailyData} margin={CHART_MARGIN}>
            <CartesianGrid strokeDasharray="3 3" stroke={colors.border.primary} vertical={false} />
            <XAxis
              dataKey="date"
              tick={{
                fontSize: 10,
                fill: colors.text.secondary,
              }}
              tickLine={false}
              axisLine={{
                stroke: colors.border.primary,
              }}
              tickFormatter={formatAnalyticsChartDayLabel}
              interval="preserveStartEnd"
              minTickGap={28}
            />
            <YAxis
              allowDecimals={false}
              tick={{
                fontSize: 10,
                fill: colors.text.secondary,
              }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip
              content={<CustomTooltip />}
              cursor={{
                stroke: colors.border.primary,
                strokeDasharray: '4 4',
              }}
            />
            <Line
              type="monotone"
              dataKey="totalBookings"
              stroke={colors.brand.primary}
              strokeWidth={3}
              dot={false}
              activeDot={{
                r: 6,
                fill: colors.brand.primary,
                stroke: colors.surface.card,
                strokeWidth: 2,
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) {
    return null;
  }

  const day = typeof label === 'string' ? formatAnalyticsChartDayLabel(label) : label;

  return (
    <div
      className="rounded-xl border p-3 shadow-xl"
      style={{
        backgroundColor: colors.surface.modal,
        borderColor: colors.border.primary,
      }}
    >
      <p className="text-sm font-semibold text-text-primary">{day}</p>

      <p className="mt-1 text-xs text-text-secondary">
        Bookings: <span className="font-medium text-text-primary">{payload[0]?.value ?? 0}</span>
      </p>
    </div>
  );
}
