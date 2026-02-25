'use client';

import { Card } from '@tremor/react';
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export default function BookingTrendChart({
  dailyData,
}: {
  dailyData: { date: string; totalBookings: number; revenue?: number }[];
}) {
  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm min-w-0">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Bookings Over Time</h3>
      <div className="h-72 min-h-[180px] min-w-0">
        <div style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number | string | undefined, name?: string) => [
                  value ?? 0,
                  name === 'totalBookings' ? 'Bookings' : name || 'Value',
                ]}
                labelFormatter={(label) => `Date: ${label}`}
              />
              <Line
                type="monotone"
                dataKey="totalBookings"
                stroke="#0f172a"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
