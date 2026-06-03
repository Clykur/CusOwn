'use client';

function StatusDot({ status }: { status: 'healthy' | 'warning' | 'critical' }) {
  const cls =
    status === 'healthy'
      ? 'bg-state-success'
      : status === 'warning'
        ? 'bg-amber-400'
        : 'bg-rose-500';
  return <span className={`inline-block w-3 h-3 rounded-full ${cls}`} />;
}

export default function OperationalInsights({ insights }: { insights?: any }) {
  return (
    <div className="rounded-xl border border-border-primary bg-surface-card p-5 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">Operational Insights</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="flex items-center justify-between rounded-lg border border-border-primary bg-surface-elevated p-3">
          <div>
            <div className="text-xs text-text-secondary">Failed Bookings (24h)</div>
            <div className="text-lg font-bold">{insights?.failedBookings ?? '—'}</div>
          </div>
          <StatusDot status={insights?.failedBookings > 5 ? 'warning' : 'healthy'} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border-primary bg-surface-elevated p-3">
          <div>
            <div className="text-xs text-text-secondary">Cron Health</div>
            <div className="text-lg font-bold">{insights?.cronHealthy ? 'OK' : 'Problem'}</div>
          </div>
          <StatusDot status={insights?.cronHealthy ? 'healthy' : 'critical'} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border-primary bg-surface-elevated p-3">
          <div>
            <div className="text-xs text-text-secondary">System Errors</div>
            <div className="text-lg font-bold">{insights?.systemErrors ?? 0}</div>
          </div>
          <StatusDot status={insights?.systemErrors > 0 ? 'warning' : 'healthy'} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border-primary bg-surface-elevated p-3">
          <div>
            <div className="text-xs text-text-secondary">Upcoming (24h)</div>
            <div className="text-lg font-bold">{insights?.upcoming ?? '—'}</div>
          </div>
          <StatusDot status={insights?.upcoming > 5 ? 'warning' : 'healthy'} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border-primary bg-surface-elevated p-3">
          <div>
            <div className="text-xs text-text-secondary">Repeat Customers</div>
            <div className="text-lg font-bold">{insights?.repeatCustomers ?? '—'}</div>
          </div>
          <StatusDot status={'healthy'} />
        </div>

        <div className="flex items-center justify-between rounded-lg border border-border-primary bg-surface-elevated p-3">
          <div>
            <div className="text-xs text-text-secondary">Customer Growth</div>
            <div className="text-lg font-bold">{insights?.customerGrowth ?? '—'}</div>
          </div>
          <StatusDot status={insights?.customerGrowth > 0 ? 'healthy' : 'warning'} />
        </div>
      </div>
    </div>
  );
}
