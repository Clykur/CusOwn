'use client';

import { useState, useCallback } from 'react';
import { useOptimisticMutation } from '@/lib/hooks/use-optimistic-action';
import CloseIcon from '@/src/icons/close.svg';
import CheckIcon from '@/src/icons/check.svg';

interface NoShowButtonProps {
  bookingId: string;
  onMarked?: () => void;
}

export default function NoShowButton({ bookingId, onMarked }: NoShowButtonProps) {
  const [isMarked, setIsMarked] = useState(false);

  const noShowMutation = useOptimisticMutation({
    mutationFn: async () => {
      const csrfToken = await (await import('@/lib/utils/csrf-client')).getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      const response = await fetch(`/api/bookings/${bookingId}/no-show`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to mark no-show');
      }

      return result;
    },
    onMutate: () => {
      setIsMarked(true);
    },
    onSuccess: () => {
      if (onMarked) onMarked();
    },
    onError: () => {
      setIsMarked(false);
    },
  });

  const handleMarkNoShow = useCallback(async () => {
    if (noShowMutation.isPending || isMarked) return;
    if (!confirm('Mark this booking as no-show? The slot will be released.')) {
      return;
    }

    try {
      await noShowMutation.mutate(undefined);
    } catch {
      // Error handled in onError
    }
  }, [noShowMutation, isMarked]);

  if (isMarked && !noShowMutation.isError) {
    return (
      <div className="w-full min-h-[44px] px-3 py-2.5 sm:px-4 sm:py-2 bg-amber-100 text-amber-800 text-sm sm:text-base font-semibold rounded-lg flex items-center justify-center gap-2">
        {noShowMutation.isPending ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-amber-800 border-t-transparent" />
            <span>Marking as no-show...</span>
          </>
        ) : (
          <>
            <CheckIcon className="w-5 h-5" aria-hidden="true" />
            <span>Marked as No-Show</span>
          </>
        )}
      </div>
    );
  }

  return (
    <div>
      <button
        onClick={handleMarkNoShow}
        disabled={noShowMutation.isPending}
        className="w-full min-h-[44px] px-3 py-2.5 sm:px-4 sm:py-2 bg-gray-200 text-gray-800 text-sm sm:text-base font-semibold rounded-lg hover:bg-gray-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 max-w-full box-border"
      >
        {noShowMutation.isPending ? (
          <>
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-gray-800 border-t-transparent" />
            <span>Marking...</span>
          </>
        ) : (
          <>
            <CloseIcon className="w-5 h-5" aria-hidden="true" />
            <span>Mark No-Show</span>
          </>
        )}
      </button>
      {noShowMutation.isError && (
        <p className="text-sm text-red-600 mt-2 p-2 bg-red-50 rounded">
          {noShowMutation.error?.message}
        </p>
      )}
    </div>
  );
}
