'use client';

import { useEffect } from 'react';
import CheckIcon from '@cusown/shared/icons/check.svg';

const TOAST_DURATION_MS = 3500;

export type ToastVariant = 'success' | 'error' | 'default';

export function Toast({
  message,
  variant = 'success',
  onDismiss,
  duration = TOAST_DURATION_MS,
}: {
  message: string;
  variant?: ToastVariant;
  onDismiss: () => void;
  duration?: number;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  const variantStyles =
    variant === 'success'
      ? 'bg-zinc-900/90 backdrop-blur-md text-emerald-400 border-emerald-500/20'
      : variant === 'error'
        ? 'bg-zinc-900/90 backdrop-blur-md text-red-400 border-red-500/20'
        : 'bg-zinc-900/90 backdrop-blur-md text-text-primary border-border-primary';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed left-1/2 top-6 z-[100] -translate-x-1/2 px-4 py-3 text-sm font-medium shadow-lg border rounded-lg md:bottom-6 md:top-auto ${variantStyles}`}
    >
      {variant === 'success' && (
        <span className="inline-flex items-center gap-2">
          <CheckIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
          {message}
        </span>
      )}
      {variant !== 'success' && message}
    </div>
  );
}
