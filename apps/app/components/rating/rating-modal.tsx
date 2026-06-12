'use client';

import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, Loader2, Star, X } from 'lucide-react';
import { useUIStore } from '@cusown/shared/client';
import type { PendingRatingBooking } from '@cusown/shared';
import { RATING_MESSAGES } from '@cusown/config';

interface RatingModalProps {
  booking: PendingRatingBooking;
  onClose: () => void;
  onSuccess: () => void;
}

export function RatingModal({ booking, onClose, onSuccess }: RatingModalProps) {
  const [rating, setRating] = useState<number | null>(null);
  const [hoveredRating, setHoveredRating] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [actionType, setActionType] = useState<'submit' | 'ignore' | null>(null);
  const [error, setError] = useState<string | null>(null);
  const showToast = useUIStore((state) => state.showToast);

  const displayRating = hoveredRating || rating;

  const formattedServiceDate = useMemo(() => {
    try {
      const date = new Date(`${booking.service_date}T${booking.service_time}`);
      if (Number.isNaN(date.getTime())) {
        return `${booking.service_date} at ${booking.service_time}`;
      }

      return new Intl.DateTimeFormat('en-IN', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      }).format(date);
    } catch {
      return `${booking.service_date} at ${booking.service_time}`;
    }
  }, [booking.service_date, booking.service_time]);

  const helperText = useMemo(() => {
    if (displayRating) return RATING_MESSAGES[displayRating];
    return 'Tap a star to rate';
  }, [displayRating]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isLoading) return;
      if (event.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isLoading, onClose]);

  const handleSubmitRating = async () => {
    if (!rating) {
      setError('Please select a rating');
      return;
    }

    setIsLoading(true);
    setActionType('submit');
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

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to submit rating');
      }

      showToast('Thanks for your review', 'success');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
      setActionType(null);
    }
  };

  const handleIgnore = async () => {
    setIsLoading(true);
    setActionType('ignore');
    setError(null);

    try {
      const response = await fetch('/api/reviews/ignore', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          booking_id: booking.id,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error || 'Failed to ignore rating');
      }

      showToast('Review skipped', 'success');
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsLoading(false);
      setActionType(null);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!isLoading) onClose();
      }}
    >
      <div
        className="w-full max-w-[390px] rounded-[20px] border border-border-primary bg-surface-card p-5 shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="rating-modal-title"
      >
        <div className="flex items-start justify-between">
          <div className="pr-3">
            <h2
              id="rating-modal-title"
              className="text-[22px] font-semibold tracking-tight text-text-primary"
            >
              Rate your experience
            </h2>
            <p className="mt-1 text-sm font-medium text-text-secondary">{booking.salon_name}</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            aria-label="Close"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full text-text-secondary transition hover:bg-surface-elevated hover:text-text-primary disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-border-primary bg-surface-input px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-elevated shadow-sm ring-1 ring-border-primary">
              <CalendarDays className="h-4 w-4 text-text-secondary" />
            </div>

            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-text-secondary">
                Service date
              </p>
              <p className="mt-1 text-sm font-medium text-text-primary">{formattedServiceDate}</p>
            </div>
          </div>
        </div>

        <div className="pt-5">
          <p className="text-center text-[15px] font-medium text-text-primary">
            How would you rate your experience?
          </p>

          <div className="mt-4 flex items-center justify-center gap-1">
            {[1, 2, 3, 4, 5].map((star) => {
              const starVal = star;
              const active = starVal <= (displayRating || 0);

              return (
                <button
                  key={starVal}
                  type="button"
                  onClick={() => {
                    setRating(starVal);
                    setError(null);
                  }}
                  onMouseEnter={() => setHoveredRating(starVal)}
                  onMouseLeave={() => setHoveredRating(null)}
                  disabled={isLoading}
                  aria-label={`Rate ${starVal} star${starVal > 1 ? 's' : ''}`}
                  className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-all duration-200 disabled:opacity-50 ${
                    active ? 'scale-105' : 'hover:scale-105'
                  }`}
                >
                  <Star
                    className={`h-8 w-8 transition-all duration-200 ${
                      active
                        ? 'fill-yellow-400 text-yellow-400 drop-shadow-[0_2px_8px_rgba(250,204,21,0.28)]'
                        : 'text-text-disabled hover:text-yellow-300'
                    }`}
                  />
                </button>
              );
            })}
          </div>

          <p
            className={`mt-3 min-h-[20px] text-center text-sm font-medium ${
              displayRating ? 'text-text-primary' : 'text-text-secondary'
            }`}
          >
            {helperText}
          </p>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-state-error/20 bg-state-error/10 px-3 py-2 text-sm text-state-error">
            {error}
          </div>
        )}

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={handleSubmitRating}
            disabled={isLoading || !rating}
            className="inline-flex h-11 w-full items-center justify-center rounded-full bg-brand-primary px-4 text-sm font-semibold text-text-inverse transition hover:bg-brand-primaryHover disabled:cursor-not-allowed disabled:bg-brand-primary/40"
          >
            {isLoading && actionType === 'submit' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit review'
            )}
          </button>

          <button
            type="button"
            onClick={handleIgnore}
            disabled={isLoading}
            className="inline-flex h-11 w-full items-center justify-center rounded-full border border-border-primary bg-surface-card px-4 text-sm font-semibold text-text-secondary transition hover:bg-surface-elevated disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading && actionType === 'ignore' ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              'Ignore'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
