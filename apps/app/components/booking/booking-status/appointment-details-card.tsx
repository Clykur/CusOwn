'use client';

import { memo, useState } from 'react';
import { formatDate, formatTime } from '@cusown/shared';
import { UI_CUSTOMER, ERROR_MESSAGES } from '@cusown/config';
import BookingsIcon from '@cusown/shared/icons/bookings.svg';
import StarRating from '@/components/booking/star-rating';

interface AppointmentDetailsCardProps {
  slot: {
    date: string;
    start_time: string;
    end_time: string;
  };
  services?: { name: string }[];
  review?: {
    rating: number;
    comment?: string;
  };
  status: string;
  bookingId: string;
  onReviewSubmitted: () => void;
}

function AppointmentDetailsCardComponent({
  slot,
  services,
  review,
  status,
  bookingId,
  onReviewSubmitted,
}: AppointmentDetailsCardProps) {
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewComment, setReviewComment] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (reviewRating < 1 || reviewRating > 5) return;
    setReviewError(null);
    setSubmittingReview(true);
    try {
      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          booking_id: bookingId,
          rating: reviewRating,
          comment: reviewComment.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setReviewError(data?.error || 'Failed to submit rating');
        return;
      }
      setReviewRating(0);
      setReviewComment('');
      onReviewSubmitted();
    } catch {
      setReviewError(ERROR_MESSAGES.DATABASE_ERROR);
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="bg-surface-elevated rounded-xl p-6 border border-border-primary">
      <h2 className="text-lg font-semibold text-text-primary mb-4 flex items-center gap-2">
        <BookingsIcon className="w-5 h-5 text-text-secondary" aria-hidden="true" />
        Appointment Details
      </h2>
      <div className="space-y-3">
        <div>
          <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Date</p>
          <p className="font-semibold text-text-primary">{formatDate(slot.date)}</p>
        </div>
        <div>
          <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Service</p>
          <div className="font-semibold text-text-primary">
            {services && services.length > 0
              ? services.map((service, index) => <p key={index}>{service.name}</p>)
              : '—'}
          </div>{' '}
        </div>
        <div>
          <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">Time</p>
          <p className="font-semibold text-text-primary">
            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
          </p>
        </div>
        <div>
          <p className="text-xs text-text-secondary uppercase tracking-wide mb-1">
            {UI_CUSTOMER.LABEL_YOUR_RATING}
          </p>
          {review ? (
            <div className="space-y-2">
              <StarRating value={review.rating} readonly size="md" />
              <p className="text-sm font-semibold text-text-primary">{review.rating} out of 5</p>
              {review.comment && (
                <p className="text-sm text-text-secondary mt-2 p-3 bg-surface-elevated rounded-lg">
                  {review.comment}
                </p>
              )}
            </div>
          ) : status === 'confirmed' ? (
            <form onSubmit={handleSubmitReview} className="space-y-3">
              <p className="text-sm text-text-secondary mb-2">{UI_CUSTOMER.RATE_YOUR_VISIT}</p>
              <StarRating
                value={reviewRating}
                readonly={false}
                size="md"
                onChange={setReviewRating}
                disabled={submittingReview}
              />
              <label className="block">
                <span className="text-xs text-text-secondary uppercase tracking-wide">
                  {UI_CUSTOMER.ADD_COMMENT_OPTIONAL}
                </span>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  disabled={submittingReview}
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-border-primary px-3 py-2 text-sm text-text-primary placeholder-slate-400 focus:border-border-primary focus:outline-none focus:ring-1 focus:ring-border-focus disabled:opacity-50"
                  placeholder="Share your experience..."
                />
              </label>
              {reviewError && <p className="text-sm text-state-error">{reviewError}</p>}
              <button
                type="submit"
                disabled={submittingReview || reviewRating < 1}
                className="px-4 py-2.5 bg-brand-primary text-text-inverse font-semibold rounded-xl hover:bg-brand-primaryHover disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {submittingReview ? UI_CUSTOMER.SUBMITTING_RATING : UI_CUSTOMER.SUBMIT_RATING}
              </button>
            </form>
          ) : (
            <p className="text-sm text-text-secondary">{UI_CUSTOMER.LABEL_NOT_RATED}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export const AppointmentDetailsCard = memo(AppointmentDetailsCardComponent);
