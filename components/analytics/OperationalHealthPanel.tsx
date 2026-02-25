'use client';

import { Card } from '@tremor/react';

function statusMeta(value: number, warningAt: number, criticalAt: number) {
  if (value >= criticalAt)
    return { label: 'Critical', cls: 'bg-rose-50 text-rose-700 border-rose-200' };
  if (value >= warningAt)
    return { label: 'Warning', cls: 'bg-amber-50 text-amber-700 border-amber-200' };
  return { label: 'Healthy', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
}

export default function OperationalHealthPanel({
  insights,
  lastUpdatedAt,
}: {
  insights: {
    failedBookings: number;
    cronHealthy: boolean;
    systemErrors: number;
    upcoming: number;
    repeatCustomers: number;
    customerGrowth: number | null;
  };
  lastUpdatedAt: Date | null;
}) {
  const cards = [
    {
      title: 'Failed Bookings (24h)',
      value: insights.failedBookings,
      status: statusMeta(insights.failedBookings, 3, 8),
    },
    {
      title: 'Cron Status',
      value: insights.cronHealthy ? 'OK' : 'Issue',
      status: insights.cronHealthy
        ? { label: 'Healthy', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
        : { label: 'Critical', cls: 'bg-rose-50 text-rose-700 border-rose-200' },
    },
    {
      title: 'System Errors',
      value: insights.systemErrors,
      status: statusMeta(insights.systemErrors, 1, 4),
    },
    {
      title: 'Upcoming (24h)',
      value: insights.upcoming,
      status: statusMeta(insights.upcoming, 20, 40),
    },
    {
      title: 'Repeat Customers',
      value: insights.repeatCustomers,
      status: { label: 'Healthy', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    },
    {
      title: 'Customer Growth Trend',
      value: insights.customerGrowth == null ? '—' : `${insights.customerGrowth}%`,
      status:
        (insights.customerGrowth ?? 0) >= 0
          ? { label: 'Healthy', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
          : { label: 'Warning', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
    },
  ];

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Operational Intelligence</h3>
        <span className="text-xs text-slate-500">
          Last updated {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : '—'}
        </span>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <div key={c.title} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{c.title}</p>
                <p className="mt-1 text-xl font-semibold text-slate-900">{c.value}</p>
              </div>
              <span className={`rounded-md border px-2 py-0.5 text-xs font-medium ${c.status.cls}`}>
                {c.status.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
