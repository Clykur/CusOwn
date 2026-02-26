'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { UI_ERROR_CONTEXT } from '@/config/constants';
import { ROUTES } from '@/lib/utils/navigation';

export default function Error({
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
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong</h2>
        <p className="text-gray-600 mb-8">{message}</p>
        <div className="flex flex-col gap-3">
          <button
            onClick={reset}
            className="bg-black text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-900 transition-colors"
          >
            Try again
          </button>
          <Link href={ROUTES.HOME} className="text-gray-600 hover:text-gray-900 text-sm">
            Go to home
          </Link>
        </div>
      </div>
    </div>
  );
}
