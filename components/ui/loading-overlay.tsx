'use client';

import { Spinner } from './loading-button';
import { cn } from '@/lib/utils/cn';

export interface LoadingOverlayProps {
  loading: boolean;
  children: React.ReactNode;
  className?: string;
  blur?: boolean;
  message?: string;
}

export function LoadingOverlay({
  loading,
  children,
  className,
  blur = true,
  message,
}: LoadingOverlayProps) {
  return (
    <div className={cn('relative', className)}>
      {children}
      {loading && (
        <div
          className={cn(
            'absolute inset-0 flex items-center justify-center bg-white/80 z-10',
            blur && 'backdrop-blur-sm'
          )}
          aria-busy="true"
        >
          <div className="flex flex-col items-center gap-2">
            <Spinner className="h-6 w-6 text-slate-600" />
            {message && <span className="text-sm text-slate-600">{message}</span>}
          </div>
        </div>
      )}
    </div>
  );
}

export interface InlineLoadingProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

export function InlineLoading({ className, size = 'md', text }: InlineLoadingProps) {
  const sizeClasses = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5',
  };

  return (
    <span
      className={cn('inline-flex items-center gap-2 text-slate-500', className)}
      aria-busy="true"
    >
      <Spinner className={sizeClasses[size]} />
      {text && <span className="text-sm">{text}</span>}
    </span>
  );
}

export interface PageLoadingProps {
  message?: string;
}

export function PageLoading({ message = 'Loading...' }: PageLoadingProps) {
  return (
    <div
      className="flex min-h-[50vh] items-center justify-center"
      aria-busy="true"
      aria-label={message}
    >
      <div className="flex flex-col items-center gap-3">
        <Spinner className="h-8 w-8 text-slate-400" />
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}
