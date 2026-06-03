'use client';

function intensity(value: number, max: number): string {
  if (max <= 0) return 'bg-surface-elevated';
  const ratio = value / max;
  if (ratio > 0.8) return 'bg-brand-primary';
  if (ratio > 0.6) return 'bg-brand-primary';
  if (ratio > 0.3) return 'bg-brand-primary/60';
  return 'bg-brand-primary/30';
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
    <div className="min-w-0 overflow-hidden rounded-xl border border-border-primary bg-surface-card p-4 shadow-sm md:p-6">
      <h3 className="mb-1 text-sm font-semibold text-text-primary md:mb-3">Peak Hours Heatmap</h3>
      <p className="mb-3 text-xs text-text-secondary md:hidden">
        24-hour booking density (local time).
      </p>
      <div className="-mx-1 overflow-x-auto pb-1 md:mx-0 md:overflow-visible">
        <div className="grid w-full min-w-0 grid-cols-6 gap-1.5 sm:grid-cols-8 sm:gap-2 md:grid-cols-12">
          {values.map((item) => (
            <div key={item.hour} className="min-w-0">
              <div
                className={`aspect-square max-h-10 w-full rounded-md sm:h-10 sm:max-h-none ${intensity(item.count, max)} transition-all`}
                title={`${String(item.hour).padStart(2, '0')}:00 — ${item.count} bookings`}
              />
              <div className="mt-1 text-center text-[10px] leading-none text-text-secondary sm:text-[11px]">
                {String(item.hour).padStart(2, '0')}
              </div>
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[11px] leading-snug text-text-secondary">
        Darker blocks indicate higher booking density.
      </p>
    </div>
  );
}
