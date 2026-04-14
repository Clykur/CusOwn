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
import { formatAnalyticsChartDayLabel } from '@/lib/utils/analytics-chart-format';

const CHART_MARGIN = { top: 8, right: 4, left: 0, bottom: 0 };

export default function BookingTrendChart({
  dailyData,
}: {
  dailyData: { date: string; totalBookings: number; revenue?: number }[];
}) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
      <h3 className="mb-1 text-sm font-semibold text-slate-900 md:mb-3">Bookings Over Time</h3>
      <p className="mb-3 text-xs text-slate-500 md:hidden">
        Daily booking count in the selected range.
      </p>
      <div className="h-[220px] w-full min-w-0 md:h-[260px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={dailyData} margin={CHART_MARGIN}>
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
              allowDecimals={false}
              tick={{ fontSize: 10, fill: '#64748b' }}
              tickLine={false}
              axisLine={false}
              width={28}
            />
            <Tooltip content={<CustomTooltip data={dailyData} />} />
            <Line
              type="monotone"
              dataKey="totalBookings"
              stroke="#0f172a"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (active && payload && payload.length) {
    const day = typeof label === 'string' ? formatAnalyticsChartDayLabel(label) : label;
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-2.5 text-xs shadow-lg">
        <p className="font-semibold text-slate-900">{day}</p>
        <p className="mt-0.5 text-slate-600">
          Bookings: <span className="font-medium text-slate-900">{payload[0].value ?? 0}</span>
        </p>
      </div>
    );
  }
  return null;
}
