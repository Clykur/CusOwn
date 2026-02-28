'use client';

import { Card } from '@tremor/react';
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts';

const COLORS = ['#10b981', '#64748b', '#f59e0b'];

export default function StatusBreakdownChart({
  analytics,
}: {
  analytics: {
    confirmedBookings?: number;
    rejectedBookings?: number;
    cancelledBookings?: number;
  } | null;
}) {
  const data = [
    { name: 'Confirmed', value: analytics?.confirmedBookings ?? 0 },
    { name: 'Rejected', value: analytics?.rejectedBookings ?? 0 },
    { name: 'Cancelled', value: analytics?.cancelledBookings ?? 0 },
  ];
  const total = data.reduce((sum, d) => sum + d.value, 0);

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm min-w-0">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Booking Status Breakdown</h3>
      <div className="flex h-72 items-center min-w-0">
        <div className="h-full w-1/2 min-w-0">
          <div
            style={{
              width: '100%',
              height: '100%',
              minWidth: 0,
              minHeight: 180,
            }}
          >
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={2}
                  isAnimationActive
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${entry.name}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number | undefined, name?: string) => [
                    value ?? 0,
                    name || 'Value',
                  ]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="w-1/2 space-y-2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>
          <p className="text-2xl font-semibold text-slate-900">{total}</p>
          <div className="space-y-2 pt-2">
            {data.map((item, idx) => {
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-600">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ background: COLORS[idx] }}
                    />
                    {item.name}
                  </div>
                  <span className="font-medium text-slate-800">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
