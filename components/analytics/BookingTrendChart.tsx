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
      <div className="min-h-[250px] w-full min-w-0" style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height={250}>
          <LineChart data={dailyData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
            <XAxis dataKey="date" tick={{ fontSize: 12 }} />
            <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
            <Tooltip content={<CustomTooltip data={dailyData} />} />
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
    </Card>
  );
}

function CustomTooltip({ data, active, payload, label }: any) {
  if (active && payload && payload.length) {
    const value = payload[0].value ?? 0;
    const name = payload[0].name || 'Bookings';
    return (
      <div className="p-2 bg-white border rounded shadow-lg">
        <p className="font-bold">{label}</p>
        <p>
          {name}: {value}
        </p>
      </div>
    );
  }
  return null;
}
