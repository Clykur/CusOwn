'use client';

import { useEffect } from 'react';
import CheckIcon from '@/src/icons/check.svg';

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
      ? 'bg-green-600 text-white border-green-700'
      : variant === 'error'
        ? 'bg-red-600 text-white border-red-700'
        : 'bg-slate-800 text-white border-slate-700';

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 rounded-lg shadow-lg border ${variantStyles} text-sm font-medium`}
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
