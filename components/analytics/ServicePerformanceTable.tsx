'use client';

import { useMemo, useState } from 'react';
import { UI_CONTEXT } from '@/config/constants';
import { cn } from '@/lib/utils/cn';

type ServiceRow = { id: string; name: string; count: number; revenueCents?: number };
type SortKey = 'name' | 'count' | 'revenue' | 'avgRevenue' | 'conversion';

function formatCurrency(cents?: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format((cents || 0) / 100);
}

export default function ServicePerformanceTable({ services }: { services: ServiceRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>('count');
  const [desc, setDesc] = useState(true);

  const totalBookings = useMemo(
    () =>
      Math.max(
        1,
        services.reduce((sum, s) => sum + (s.count || 0), 0)
      ),
    [services]
  );

  const rows = useMemo(() => {
    const enriched = services.map((s) => {
      const revenue = s.revenueCents || 0;
      const avgRevenue = s.count > 0 ? revenue / s.count : 0;
      const conversion = Math.round((s.count / totalBookings) * 10000) / 100;
      return { ...s, revenue, avgRevenue, conversion };
    });
    enriched.sort((a, b) => {
      const dir = desc ? -1 : 1;
      if (sortKey === 'name') return a.name.localeCompare(b.name) * dir;
      if (sortKey === 'count') return (a.count - b.count) * dir;
      if (sortKey === 'revenue') return (a.revenue - b.revenue) * dir;
      if (sortKey === 'avgRevenue') return (a.avgRevenue - b.avgRevenue) * dir;
      return (a.conversion - b.conversion) * dir;
    });
    return enriched;
  }, [desc, services, sortKey, totalBookings]);

  const onSort = (key: SortKey) => {
    if (sortKey === key) {
      setDesc((v) => !v);
      return;
    }
    setSortKey(key);
    setDesc(true);
  };

  const columns = [
    ['name', UI_CONTEXT.OWNER_ANALYTICS_SVC_COL_SERVICE],
    ['count', UI_CONTEXT.OWNER_ANALYTICS_SVC_COL_BOOKINGS],
    ['revenue', UI_CONTEXT.OWNER_ANALYTICS_SVC_COL_REVENUE],
    ['avgRevenue', UI_CONTEXT.OWNER_ANALYTICS_SVC_COL_AVG],
    ['conversion', UI_CONTEXT.OWNER_ANALYTICS_SVC_COL_CONV],
  ] as const;

  return (
    <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-slate-100 p-4 md:p-6 md:pb-3">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-semibold text-slate-900">
            {UI_CONTEXT.OWNER_ANALYTICS_SERVICE_PERFORMANCE_TITLE}
          </h3>
          <span className="text-xs text-slate-500">Top 5 highlighted</span>
        </div>
      </div>

      <div className="md:hidden">
        <div className="divide-y divide-slate-100 px-3 pb-3">
          {rows.map((row, index) => (
            <div
              key={row.id}
              className={cn(
                'py-3 first:pt-2',
                index < 5 ? 'rounded-lg bg-indigo-50/40 px-2 -mx-1' : ''
              )}
            >
              <p className="text-sm font-semibold text-slate-900">{row.name}</p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
                <div>
                  <dt className="text-slate-500">{UI_CONTEXT.OWNER_ANALYTICS_SVC_COL_BOOKINGS}</dt>
                  <dd className="font-medium text-slate-800">{row.count}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{UI_CONTEXT.OWNER_ANALYTICS_SVC_COL_REVENUE}</dt>
                  <dd className="font-medium text-slate-800">{formatCurrency(row.revenue)}</dd>
                </div>
                <div>
                  <dt className="text-slate-500">{UI_CONTEXT.OWNER_ANALYTICS_SVC_COL_AVG}</dt>
                  <dd className="font-medium text-slate-800">
                    {formatCurrency(Math.round(row.avgRevenue))}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500">{UI_CONTEXT.OWNER_ANALYTICS_SVC_COL_CONV}</dt>
                  <dd className="font-medium text-slate-800">{row.conversion}%</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>
      </div>

      <div className="hidden overflow-x-auto md:block md:px-6 md:pb-6">
        <table className="min-w-full divide-y divide-gray-200">
          <thead>
            <tr className="bg-gray-50/80">
              {columns.map(([key, label]) => (
                <th
                  key={key}
                  className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 lg:px-4"
                >
                  <button
                    type="button"
                    onClick={() => onSort(key)}
                    className="inline-flex items-center gap-1 hover:text-slate-800"
                  >
                    {label}
                    {sortKey === key ? (desc ? '↓' : '↑') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {rows.map((row, index) => (
              <tr key={row.id} className={index < 5 ? 'bg-indigo-50/30' : ''}>
                <td className="px-3 py-3 text-sm font-medium text-slate-800 lg:px-4">{row.name}</td>
                <td className="px-3 py-3 text-sm text-slate-700 lg:px-4">{row.count}</td>
                <td className="px-3 py-3 text-sm text-slate-700 lg:px-4">
                  {formatCurrency(row.revenue)}
                </td>
                <td className="px-3 py-3 text-sm text-slate-700 lg:px-4">
                  {formatCurrency(Math.round(row.avgRevenue))}
                </td>
                <td className="px-3 py-3 text-sm text-slate-700 lg:px-4">{row.conversion}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
