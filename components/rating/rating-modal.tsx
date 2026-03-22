'use client';

import { useState } from 'react';
import { X, Star } from 'lucide-react';
import type { PendingRatingBooking } from '@/services/rating-prompt.service';

interface RatingModalProps {
  booking: PendingRatingBooking;
  onClose: () => void;
  onSuccess: () => void;
}

export function RatingModal({ booking, onClose, onSuccess }: RatingModalProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmitRating = async () => {
    if (!rating) {
      setError('Please select a rating');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/reviews/pending-rating', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking.id,
          rating,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit rating');
      }

      // Success - close and fetch next pending booking
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const handleIgnore = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/reviews/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking.id,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to ignore rating');
      }

      // Success - close and fetch next pending booking
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  const displayRating = hoveredRating || rating;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between border-b border-gray-100 p-6">
          <div className="flex-1">
            <h2 className="text-xl font-semibold text-gray-900">Rate Your Experience</h2>
            <p className="mt-1 text-sm text-gray-600">{booking.salon_name}</p>
          </div>
          <button
            onClick={onClose}
            disabled={isLoading}
            className="ml-2 inline-flex items-center justify-center rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 disabled:opacity-50"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {/* Service info */}
          <div className="mb-6 rounded-lg bg-gray-50 p-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium">Service Date:</span> {booking.service_date} at{' '}
              {booking.service_time}
            </p>
          </div>

          {/* Star Rating */}
          <div className="mb-6">
            <label className="mb-3 block text-sm font-medium text-gray-700">
              How would you rate your experience?
            </label>
            <div className="flex justify-center gap-3">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHoveredRating(star)}
                  onMouseLeave={() => setHoveredRating(null)}
                  disabled={isLoading}
                  className="transition-transform duration-150 hover:scale-110 disabled:opacity-50"
                  aria-label={`Rate ${star} stars`}
                >
                  <Star
                    className={`h-10 w-10 transition-colors duration-150 ${
                      star <= (displayRating || 0)
                        ? 'fill-yellow-400 text-yellow-400'
                        : 'text-gray-300'
                    }`}
                  />
                </button>
              ))}
            </div>
            {rating && (
              <p className="mt-2 text-center text-sm font-medium text-gray-600">
                {rating} star{rating !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          {/* Error message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-600">{error}</div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3">
            <button
              onClick={handleIgnore}
              disabled={isLoading}
              className="flex-1 rounded-lg border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Ignore
            </button>
            <button
              onClick={handleSubmitRating}
              disabled={isLoading || !rating}
              className="flex-1 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {isLoading ? 'Submitting...' : 'Submit'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
