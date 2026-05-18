'use client';

import { ReactNode } from 'react';

/** Status for admin booking detail. Color-coded pill with strong emphasis. */
export function BookingStatusBadge({ status }: { status: string }) {
  const normalized = (status || '').toLowerCase();
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
  const config =
    normalized === 'confirmed'
      ? { bg: 'bg-emerald-100', text: 'text-emerald-800', label: 'Confirmed' }
      : normalized === 'cancelled' || normalized === 'rejected'
        ? { bg: 'bg-red-100', text: 'text-red-800', label: cap(status) }
        : normalized === 'pending'
          ? { bg: 'bg-amber-100', text: 'text-amber-800', label: 'Pending' }
          : { bg: 'bg-slate-100', text: 'text-slate-800', label: cap(status) };
  return (
    <span
      className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold ${config.bg} ${config.text}`}
    >
      {config.label}
    </span>
  );
}

/** Section title within a card. */
export function SectionHeader({ children }: { children: ReactNode }) {
  return <h3 className="text-base font-semibold text-slate-900 tracking-tight">{children}</h3>;
}

/** Single key/value row: muted label above or beside medium value. */
export function KeyValueRow({
  label,
  value,
  valueMonospace,
}: {
  label: string;
  value: ReactNode;
  valueMonospace?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-sm text-slate-500">{label}</span>
      <span
        className={`text-base font-medium text-slate-900 ${valueMonospace ? 'font-mono text-sm' : ''}`}
      >
        {value}
      </span>
    </div>
  );
}

/** Card container: equal-height friendly, soft border, shadow, 16px rounded, consistent padding. */
export function InfoCard({
  title,
  children,
  className = '',
}: {
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`rounded-2xl border border-slate-200/80 bg-white p-6 shadow-sm transition-shadow hover:shadow-md ${className}`}
    >
      {title && (
        <div className="mb-4">
          <SectionHeader>{title}</SectionHeader>
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </div>
  );
}

/** Destructive primary action (e.g. Cancel booking). */
export function DestructiveActionButton({
  children,
  onClick,
  disabled,
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`inline-flex items-center justify-center rounded-xl border border-red-200 bg-red-50 px-5 py-2.5 text-sm font-semibold text-red-700 shadow-sm transition-colors hover:bg-red-100 hover:border-red-300 disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto ${className}`}
    >
      {children}
    </button>
  );
}

/** Primary action (e.g. Accept). */
export function PrimaryActionButton({
  children,
  onClick,
  disabled,
  variant = 'primary',
  className = '',
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
  className?: string;
}) {
  const base =
    'inline-flex items-center justify-center rounded-xl px-5 py-2.5 text-sm font-semibold shadow-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto';
  const styles =
    variant === 'primary'
      ? 'border border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700'
      : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50';
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles} ${className}`}
    >
      {children}
    </button>
  );
}
