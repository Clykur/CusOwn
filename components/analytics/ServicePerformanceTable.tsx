'use client';

import { Card } from '@tremor/react';
import { useMemo, useState } from 'react';

type ServiceRow = {
  id: string;
  name: string;
  count: number;
  revenueCents?: number;
};

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

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900">Service Performance</h3>
        <span className="text-xs text-slate-500">Top 5 highlighted</span>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200">
          <thead>
            <tr className="bg-slate-50/80">
              {[
                ['name', 'Service'],
                ['count', 'Bookings'],
                ['revenue', 'Revenue'],
                ['avgRevenue', 'Avg Revenue'],
                ['conversion', 'Conversion %'],
              ].map(([key, label]) => (
                <th
                  key={key}
                  className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500"
                >
                  <button
                    type="button"
                    onClick={() => onSort(key as SortKey)}
                    className="inline-flex items-center gap-1 hover:text-slate-800"
                  >
                    {label}
                    {sortKey === key ? (desc ? '↓' : '↑') : ''}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {rows.map((row, index) => (
              <tr key={row.id} className={index < 5 ? 'bg-indigo-50/30' : ''}>
                <td className="px-4 py-3 text-sm font-medium text-slate-800">{row.name}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{row.count}</td>
                <td className="px-4 py-3 text-sm text-slate-700">{formatCurrency(row.revenue)}</td>
                <td className="px-4 py-3 text-sm text-slate-700">
                  {formatCurrency(Math.round(row.avgRevenue))}
                </td>
                <td className="px-4 py-3 text-sm text-slate-700">{row.conversion}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
