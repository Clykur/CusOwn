'use client';

import DateFilter from '@/components/owner/date-filter';

export default function AnalyticsHeader({
  startDate,
  endDate,
  setStartDate,
  setEndDate,
  onExport,
}: {
  startDate: string;
  endDate: string;
  setStartDate: (s: string) => void;
  setEndDate: (s: string) => void;
  onExport: () => void;
}) {
  const applyQuick = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - (days - 1));
    setStartDate(start.toISOString().split('T')[0]);
    setEndDate(end.toISOString().split('T')[0]);
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border-primary bg-surface-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-text-primary sm:text-xl">Analytics Window</h2>
          <p className="text-sm text-text-secondary">
            Choose date range and export your performance report.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <div className="hidden sm:flex gap-2">
          <button
            onClick={() => applyQuick(1)}
            className="rounded-md border border-border-primary bg-surface-elevated px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
          >
            Today
          </button>
          <button
            onClick={() => applyQuick(7)}
            className="rounded-md border border-border-primary bg-surface-elevated px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
          >
            7D
          </button>
          <button
            onClick={() => applyQuick(30)}
            className="rounded-md border border-border-primary bg-surface-elevated px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
          >
            30D
          </button>
          <button
            onClick={() => applyQuick(90)}
            className="rounded-md border border-border-primary bg-surface-elevated px-3 py-1.5 text-sm font-medium text-text-secondary hover:bg-surface-elevated"
          >
            90D
          </button>
        </div>

        <div className="w-[160px]">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
            From
          </label>
          <DateFilter value={startDate} onChange={setStartDate} />
        </div>
        <div className="w-[160px]">
          <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-text-secondary">
            To
          </label>
          <DateFilter value={endDate} onChange={setEndDate} />
        </div>

        <button
          onClick={onExport}
          className="rounded-md bg-brand-primary px-3 py-1.5 text-sm font-medium text-text-inverse hover:bg-brand-primaryHover"
        >
          Export
        </button>
      </div>
    </div>
  );
}
