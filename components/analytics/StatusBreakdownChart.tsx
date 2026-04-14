'use client';

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
    <div className="min-h-0 w-full min-w-0 overflow-hidden rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:p-6">
      <h3 className="mb-1 text-sm font-semibold text-slate-900 md:mb-4">
        Booking Status Breakdown
      </h3>
      <p className="mb-4 text-xs text-slate-500 md:hidden">Share of bookings by outcome.</p>
      <div className="flex flex-col items-stretch gap-5 sm:flex-row sm:items-start sm:gap-6">
        <div className="flex w-full justify-center sm:w-1/2 sm:justify-center">
          <div className="aspect-square w-full max-w-[200px] sm:max-w-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={52}
                  outerRadius={82}
                  paddingAngle={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={entry.name} fill={COLORS[index]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value, name) => [`${value ?? 0}`, String(name ?? '')]}
                  contentStyle={{ borderRadius: 8, fontSize: 12 }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="w-full sm:w-1/2 sm:min-w-0">
          <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3 md:border-0 md:bg-transparent md:p-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
              Total
            </p>
            <p className="text-2xl font-bold text-slate-900 md:text-3xl">{total}</p>
          </div>
          <div className="mt-3 space-y-2.5 md:mt-4 md:space-y-3">
            {data.map((item, idx) => {
              const pct = total > 0 ? Math.round((item.value / total) * 100) : 0;
              return (
                <div
                  key={item.name}
                  className="flex items-center justify-between gap-3 rounded-lg border border-transparent py-0.5 text-sm md:border-0"
                >
                  <div className="flex min-w-0 items-center gap-2 text-slate-700">
                    <span
                      className="inline-block h-2.5 w-2.5 shrink-0 rounded-full md:h-3 md:w-3"
                      style={{ backgroundColor: COLORS[idx] }}
                    />
                    <span className="truncate">{item.name}</span>
                  </div>
                  <span className="shrink-0 font-semibold tabular-nums text-slate-900">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
