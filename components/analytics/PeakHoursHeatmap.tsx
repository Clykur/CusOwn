'use client';

import { Card } from '@tremor/react';

function intensity(value: number, max: number): string {
  if (max <= 0) return 'bg-slate-100';
  const ratio = value / max;
  if (ratio > 0.8) return 'bg-slate-900';
  if (ratio > 0.6) return 'bg-slate-700';
  if (ratio > 0.4) return 'bg-slate-500';
  if (ratio > 0.2) return 'bg-slate-300';
  return 'bg-slate-200';
}

export default function PeakHoursHeatmap({
  peakHours,
}: {
  peakHours: { hour: number; bookingCount: number }[];
}) {
  const map = new Map<number, number>();
  peakHours.forEach((p) => map.set(p.hour, p.bookingCount));
  const values = Array.from({ length: 24 }).map((_, hour) => ({
    hour,
    count: map.get(hour) || 0,
  }));
  const max = Math.max(...values.map((v) => v.count), 1);

  return (
    <Card className="rounded-xl border border-slate-200 shadow-sm">
      <h3 className="mb-3 text-sm font-semibold text-slate-900">Peak Hours Heatmap</h3>
      <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-12">
        {values.map((item) => (
          <div key={item.hour} className="group relative">
            <div
              className={`h-10 rounded-md ${intensity(item.count, max)} transition-all`}
              title={`${String(item.hour).padStart(2, '0')}:00 — ${item.count} bookings`}
            />
            <div className="mt-1 text-center text-[11px] text-slate-500">
              {String(item.hour).padStart(2, '0')}
            </div>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">Darker blocks indicate higher booking density.</p>
    </Card>
  );
}
