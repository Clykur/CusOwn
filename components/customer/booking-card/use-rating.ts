import { useState, useCallback } from 'react';

interface UseRatingProps {
  bookingId: string;
  existingRating?: number;
  onRated?: () => void;
}

export function useRating({ bookingId, existingRating, onRated }: UseRatingProps) {
  const [submittingRating, setSubmittingRating] = useState(false);
  const [pendingRating, setPendingRating] = useState(0);
  const [optimisticRating, setOptimisticRating] = useState<number | null>(null);
  const [ratingSuccess, setRatingSuccess] = useState(false);

  const handleRating = useCallback(
    async (rating: number) => {
      setPendingRating(rating);
      setOptimisticRating(rating);
      setSubmittingRating(true);
      setRatingSuccess(false);

      try {
        const res = await fetch('/api/reviews', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ booking_id: bookingId, rating }),
        });

        if (res.ok) {
          setRatingSuccess(true);
          setTimeout(() => onRated?.(), 300);
        } else {
          setOptimisticRating(null);
          setPendingRating(0);
        }
      } catch {
        setOptimisticRating(null);
        setPendingRating(0);
      } finally {
        setSubmittingRating(false);
      }
    },
    [bookingId, onRated]
  );

  const displayedRating = existingRating ?? optimisticRating ?? pendingRating;

  return {
    submittingRating,
    pendingRating,
    optimisticRating,
    ratingSuccess,
    displayedRating,
    handleRating,
  };
}
