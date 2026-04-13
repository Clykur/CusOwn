'use client';

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
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm min-w-0 p-6">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Revenue Over Time</h3>
      <div className="min-h-[250px] w-full min-w-0" style={{ height: 250 }}>
        <ResponsiveContainer width="100%" height={250}>
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
              contentStyle={{ borderRadius: 10, borderColor: '#e2e8f0' }}
              formatter={(value, name) => [formatCurrency(value as number), name as string]}
              labelFormatter={(label) => label.toString()}
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
  );
}
