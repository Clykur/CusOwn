'use client';

import { UI_CONTEXT } from '@/config/constants';

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
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4 md:p-6 md:pb-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <h3 className="text-sm font-semibold text-slate-900">
            {UI_CONTEXT.OWNER_ANALYTICS_OPERATIONAL_INTEL_TITLE}
          </h3>
          <span className="text-xs text-slate-500">
            Last updated {lastUpdatedAt ? lastUpdatedAt.toLocaleTimeString() : '—'}
          </span>
        </div>
      </div>
      <div className="grid grid-cols-1 gap-2.5 p-3 sm:gap-3 md:grid-cols-2 md:p-6 xl:grid-cols-3">
        {cards.map((c) => (
          <div
            key={c.title}
            className="rounded-xl border border-gray-200 bg-gray-50/80 p-3.5 md:rounded-lg md:p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[11px] font-semibold uppercase leading-tight tracking-wide text-slate-500">
                  {c.title}
                </p>
                <p className="mt-1.5 break-words text-lg font-semibold tabular-nums text-slate-900 md:text-xl">
                  {c.value}
                </p>
              </div>
              <span
                className={`shrink-0 rounded-md border px-2 py-0.5 text-[10px] font-medium md:text-xs ${c.status.cls}`}
              >
                {c.status.label}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
