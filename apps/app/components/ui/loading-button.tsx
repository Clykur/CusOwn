'use client';

import * as React from 'react';
import { cn } from '@cusown/shared';

function Spinner({ className }: { className?: string }) {
  return (
    <svg
      className={cn('animate-spin', className)}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

export interface LoadingButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  loadingText?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'destructive';
  size?: 'default' | 'sm' | 'lg';
}

const LoadingButton = React.forwardRef<HTMLButtonElement, LoadingButtonProps>(
  (
    {
      className,
      children,
      loading = false,
      loadingText,
      variant = 'default',
      size = 'default',
      disabled,
      ...props
    },
    ref
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        className={cn(
          'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50',
          {
            'bg-brand-primary text-text-inverse hover:bg-brand-primaryHover': variant === 'default',
            'border border-border-primary bg-surface-card text-text-primary hover:bg-surface-elevated':
              variant === 'outline',
            'text-text-primary hover:bg-surface-elevated': variant === 'ghost',
            'bg-state-error text-text-inverse hover:bg-red-700': variant === 'destructive',
            'h-10 px-4 py-2': size === 'default',
            'h-9 px-3 text-sm': size === 'sm',
            'h-11 px-8 text-lg': size === 'lg',
          },
          className
        )}
        ref={ref}
        disabled={isDisabled}
        aria-busy={loading}
        {...props}
      >
        {loading && <Spinner className="h-4 w-4" />}
        {loading && loadingText ? loadingText : children}
      </button>
    );
  }
);
LoadingButton.displayName = 'LoadingButton';

export { LoadingButton, Spinner };
