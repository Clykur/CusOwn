'use client';

import { memo } from 'react';
import StarRating from '@/components/booking/star-rating';
import { UI_CUSTOMER } from '@/config/constants';

interface BookingCardRatingProps {
  hasReview: boolean;
  isConfirmed: boolean;
  displayedRating: number;
  pendingRating: number;
  submittingRating: boolean;
  ratingSuccess: boolean;
  onRating: (rating: number) => void;
  variant: 'mobile' | 'desktop';
}

function BookingCardRatingComponent({
  hasReview,
  isConfirmed,
  displayedRating,
  pendingRating,
  submittingRating,
  ratingSuccess,
  onRating,
  variant,
}: BookingCardRatingProps) {
  if (variant === 'mobile') {
    return (
      <div className="flex justify-between text-sm items-center">
        <span className="text-slate-500 uppercase">{UI_CUSTOMER.LABEL_YOUR_RATING}</span>
        {hasReview ? (
          <div className="flex items-center gap-2">
            <StarRating value={displayedRating} readonly size="sm" />
            {ratingSuccess && (
              <span className="text-green-600 text-xs font-medium animate-in fade-in">✓ Saved</span>
            )}
          </div>
        ) : isConfirmed ? (
          <StarRating
            value={pendingRating}
            readonly={false}
            size="sm"
            disabled={submittingRating}
            onChange={onRating}
          />
        ) : (
          <p className="text-sm text-slate-500">{UI_CUSTOMER.LABEL_NOT_RATED}</p>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <div className="bg-slate-100 rounded-lg p-2">
        <span className="text-amber-500 font-bold">★</span>
      </div>
      <div>
        <p className="text-xs text-slate-500 uppercase">Rating</p>
        {hasReview ? (
          <div className="flex items-center gap-1">
            <StarRating value={displayedRating} readonly size="sm" />
            <span className="text-sm font-semibold">{displayedRating}</span>
            {ratingSuccess && <span className="text-green-600 text-xs animate-in fade-in">✓</span>}
          </div>
        ) : isConfirmed ? (
          <StarRating
            value={pendingRating}
            readonly={false}
            size="sm"
            disabled={submittingRating}
            onChange={onRating}
          />
        ) : (
          <p className="text-xs text-slate-500">Not rated</p>
        )}
      </div>
    </div>
  );
}

export const BookingCardRating = memo(BookingCardRatingComponent);
