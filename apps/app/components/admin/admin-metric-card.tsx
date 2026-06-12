'use client';

import { memo } from 'react';

export type AdminMetricCardProps = {
  label: string;
  value: React.ReactNode;
  secondary?: React.ReactNode;
  secondaryVariant?: 'positive' | 'negative' | 'neutral';
};

function AdminMetricCardComponent({
  label,
  value,
  secondary,
  secondaryVariant = 'neutral',
}: AdminMetricCardProps) {
  const secondaryClass =
    secondaryVariant === 'positive'
      ? 'text-state-success font-semibold'
      : secondaryVariant === 'negative'
        ? 'text-state-error font-semibold'
        : 'text-text-tertiary';

  return (
    <div className="flex h-full flex-col rounded-xl border border-border-primary bg-surface-card p-5 hover:border-[#00E676]/40 hover:shadow-[0_0_12px_rgba(0,230,118,0.06)] hover:-translate-y-0.5 transition-all duration-200 ease-out select-none">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-text-secondary font-mono">
        {label}
      </p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-text-primary font-display">
        {value}
      </p>
      {secondary != null && <p className={`mt-1 text-xs ${secondaryClass}`}>{secondary}</p>}
    </div>
  );
}

export const AdminMetricCard = memo(AdminMetricCardComponent);
