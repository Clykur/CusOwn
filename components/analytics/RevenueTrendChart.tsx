'use client';

import { Card } from '@tremor/react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

function formatCurrency(v: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(v || 0);
}

export default function RevenueTrendChart({
  dailyData,
}: {
  dailyData: { date: string; revenue?: number; totalBookings: number }[];
}) {
  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm min-w-0">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Revenue Over Time</h3>
      <div className="h-72 min-h-[180px] min-w-0">
        <div style={{ width: '100%', height: '100%', minWidth: 0, minHeight: 180 }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#334155" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#334155" stopOpacity={0.04} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip
                formatter={(value: number | string | undefined, name?: string) => {
                  if (name === 'revenue') {
                    return [formatCurrency(Number(value || 0)), 'Revenue'];
                  }
                  return [value, name || 'Value'];
                }}
                contentStyle={{ borderRadius: 10, borderColor: '#e2e8f0' }}
                labelFormatter={(label, payload) => {
                  const bookings = payload?.[0]?.payload?.totalBookings ?? 0;
                  return `${label} • ${bookings} bookings`;
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#334155"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#revenueGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </Card>
  );
}
