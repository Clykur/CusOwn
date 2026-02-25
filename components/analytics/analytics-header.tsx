'use client';

import React from 'react';

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
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900 sm:text-xl">Analytics Window</h2>
          <p className="text-sm text-slate-500">
            Choose date range and export your performance report.
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="hidden sm:flex gap-2">
          <button
            onClick={() => applyQuick(1)}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            Today
          </button>
          <button
            onClick={() => applyQuick(7)}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            7D
          </button>
          <button
            onClick={() => applyQuick(30)}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            30D
          </button>
          <button
            onClick={() => applyQuick(90)}
            className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-100"
          >
            90D
          </button>
        </div>

        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />
        <input
          type="date"
          value={endDate}
          onChange={(e) => setEndDate(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-sm text-slate-700 focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200"
        />

        <button
          onClick={onExport}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Export
        </button>
      </div>
    </div>
  );
}
