'use client';

import { useEffect } from 'react';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Something went wrong!</h2>
        <p className="text-gray-600 mb-8">{error.message || 'An unexpected error occurred'}</p>
        <button
          onClick={reset}
          className="bg-black text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-900 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

