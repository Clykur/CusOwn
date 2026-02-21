'use client';

import { useEffect } from 'react';

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
          <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          {message}
        </span>
      )}
      {variant !== 'success' && message}
    </div>
  );
}
