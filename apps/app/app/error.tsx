'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { UI_ERROR_CONTEXT } from '@cusown/config';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const pathname = usePathname();

  useEffect(() => {
    console.error(error);
  }, [error]);

  const getContextMessage = () => {
    if (!pathname) return UI_ERROR_CONTEXT.GENERIC;
    if (pathname.startsWith('/booking') || pathname.startsWith('/b/'))
      return UI_ERROR_CONTEXT.BOOKING_PAGE;
    if (pathname.startsWith('/accept') || pathname.startsWith('/reject'))
      return UI_ERROR_CONTEXT.ACCEPT_REJECT_PAGE;
    if (pathname.includes('dashboard')) return UI_ERROR_CONTEXT.DASHBOARD_PAGE;
    return UI_ERROR_CONTEXT.GENERIC;
  };

  const message = getContextMessage();

  return (
    <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900/40 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
        <h2 className="text-2xl font-bold text-white mb-4">Something went wrong</h2>
        <p className="text-zinc-400 mb-8">{message}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="bg-brand-primary text-black font-semibold py-3 px-6 rounded-lg hover:bg-brand-primaryHover transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    </div>
  );
}
