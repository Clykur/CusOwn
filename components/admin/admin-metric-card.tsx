'use client';

/**
 * Reusable metric card for admin dashboard. Equal height, consistent padding, soft shadow.
 */
export type AdminMetricCardProps = {
  label: string;
  value: React.ReactNode;
  /** Optional secondary line (e.g. growth %, or "2 suspended") */
  secondary?: React.ReactNode;
  /** Optional: green/red for growth indicators */
  secondaryVariant?: 'positive' | 'negative' | 'neutral';
};

export function AdminMetricCard({
  label,
  value,
  secondary,
  secondaryVariant = 'neutral',
}: AdminMetricCardProps) {
  const secondaryClass =
    secondaryVariant === 'positive'
      ? 'text-emerald-600'
      : secondaryVariant === 'negative'
        ? 'text-red-600'
        : 'text-slate-500';

  return (
    <div className="flex h-full flex-col rounded-2xl border border-slate-200/80 bg-white p-5 shadow-sm transition-shadow hover:shadow-md">
      <p className="text-xs font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      {secondary != null && <p className={`mt-1 text-xs ${secondaryClass}`}>{secondary}</p>}
    </div>
  );
}
