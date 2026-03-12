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
    <Card className="rounded-xl border border-slate-200 shadow-sm">
      <h3 className="mb-4 text-sm font-semibold text-slate-900">Booking Status Breakdown</h3>

      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
        {/* Chart */}
        <div className="w-full sm:w-1/2 flex justify-center">
          <div className="w-[220px] h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index]} />
                  ))}
                </Pie>

                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Legend */}
        <div className="w-full sm:w-1/2">
          <p className="text-xs uppercase tracking-wide text-slate-500">Total</p>

          <p className="text-3xl font-bold text-slate-900 mb-4">{total}</p>

          <div className="space-y-3">
            {data.map((item, idx) => {
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;

              return (
                <div key={item.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2 text-slate-700">
                    <span
                      className="inline-block h-3 w-3 rounded-full"
                      style={{ backgroundColor: COLORS[idx] }}
                    />
                    {item.name}
                  </div>

                  <span className="font-medium text-slate-900">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
