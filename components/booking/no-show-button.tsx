'use client';

import { useState } from 'react';

interface NoShowButtonProps {
  bookingId: string;
  onMarked?: () => void;
}

export default function NoShowButton({ bookingId, onMarked }: NoShowButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleMarkNoShow = async () => {
    if (loading) return;
    if (!confirm('Mark this booking as no-show? The slot will be released.')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/bookings/${bookingId}/no-show`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to mark no-show');
      }

      if (onMarked) onMarked();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to mark no-show');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleMarkNoShow}
        disabled={loading}
        className="w-full min-h-[44px] px-3 py-2.5 sm:px-4 sm:py-2 bg-gray-200 text-gray-800 text-sm sm:text-base font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 max-w-full box-border"
      >
        {loading ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-800 border-t-transparent"></div>
            <span>Marking...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
            <span>Mark No-Show</span>
          </>
        )}
      </button>
      {error && <p className="text-sm text-gray-900 mt-2 p-2 bg-gray-100 rounded">{error}</p>}
    </div>
  );
}
