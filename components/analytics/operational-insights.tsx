'use client';

import React from 'react';

function StatusDot({ status }: { status: 'healthy' | 'warning' | 'critical' }) {
  const cls =
    status === 'healthy' ? 'bg-green-500' : status === 'warning' ? 'bg-amber-400' : 'bg-rose-500';
  return <span className={`inline-block w-3 h-3 rounded-full ${cls}`} />;
}

export default function OperationalInsights({ insights }: { insights?: any }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Operational Insights</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div>
            <div className="text-xs text-gray-500">Failed Bookings (24h)</div>
            <div className="text-lg font-bold">{insights?.failedBookings ?? '—'}</div>
          </div>
          <StatusDot status={insights?.failedBookings > 5 ? 'warning' : 'healthy'} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div>
            <div className="text-xs text-gray-500">Cron Health</div>
            <div className="text-lg font-bold">{insights?.cronHealthy ? 'OK' : 'Problem'}</div>
          </div>
          <StatusDot status={insights?.cronHealthy ? 'healthy' : 'critical'} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div>
            <div className="text-xs text-gray-500">System Errors</div>
            <div className="text-lg font-bold">{insights?.systemErrors ?? 0}</div>
          </div>
          <StatusDot status={insights?.systemErrors > 0 ? 'warning' : 'healthy'} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div>
            <div className="text-xs text-gray-500">Upcoming (24h)</div>
            <div className="text-lg font-bold">{insights?.upcoming ?? '—'}</div>
          </div>
          <StatusDot status={insights?.upcoming > 5 ? 'warning' : 'healthy'} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div>
            <div className="text-xs text-gray-500">Repeat Customers</div>
            <div className="text-lg font-bold">{insights?.repeatCustomers ?? '—'}</div>
          </div>
          <StatusDot status={'healthy'} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50/70 p-3">
          <div>
            <div className="text-xs text-gray-500">Customer Growth</div>
            <div className="text-lg font-bold">{insights?.customerGrowth ?? '—'}</div>
          </div>
          <StatusDot status={insights?.customerGrowth > 0 ? 'healthy' : 'warning'} />
        </div>
      </div>
    </div>
  );
}
