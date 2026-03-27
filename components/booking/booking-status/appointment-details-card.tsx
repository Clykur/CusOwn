'use client';

import { memo, useState } from 'react';
import { formatDate, formatTime } from '@/lib/utils/string';
import { UI_CUSTOMER, ERROR_MESSAGES } from '@/config/constants';
import BookingsIcon from '@/src/icons/bookings.svg';
import StarRating from '@/components/booking/star-rating';

interface AppointmentDetailsCardProps {
  slot: {
    date: string;
    start_time: string;
    end_time: string;
  };
  serviceName?: string;
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
  serviceName,
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
    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200">
      <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
        <BookingsIcon className="w-5 h-5 text-slate-600" aria-hidden="true" />
        Appointment Details
      </h2>
      <div className="space-y-3">
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Date</p>
          <p className="font-semibold text-slate-900">{formatDate(slot.date)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Service</p>
          <p className="font-semibold text-slate-900">{serviceName || '—'}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">Time</p>
          <p className="font-semibold text-slate-900">
            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
          </p>
        </div>
        <div>
          <p className="text-xs text-slate-500 uppercase tracking-wide mb-1">
            {UI_CUSTOMER.LABEL_YOUR_RATING}
          </p>
          {review ? (
            <div className="space-y-2">
              <StarRating value={review.rating} readonly size="md" />
              <p className="text-sm font-semibold text-slate-900">{review.rating} out of 5</p>
              {review.comment && (
                <p className="text-sm text-slate-600 mt-2 p-3 bg-slate-100 rounded-lg">
                  {review.comment}
                </p>
              )}
            </div>
          ) : status === 'confirmed' ? (
            <form onSubmit={handleSubmitReview} className="space-y-3">
              <p className="text-sm text-slate-600 mb-2">{UI_CUSTOMER.RATE_YOUR_VISIT}</p>
              <StarRating
                value={reviewRating}
                readonly={false}
                size="md"
                onChange={setReviewRating}
                disabled={submittingReview}
              />
              <label className="block">
                <span className="text-xs text-slate-500 uppercase tracking-wide">
                  {UI_CUSTOMER.ADD_COMMENT_OPTIONAL}
                </span>
                <textarea
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  disabled={submittingReview}
                  rows={3}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-500 disabled:opacity-50"
                  placeholder="Share your experience..."
                />
              </label>
              {reviewError && <p className="text-sm text-red-600">{reviewError}</p>}
              <button
                type="submit"
                disabled={submittingReview || reviewRating < 1}
                className="px-4 py-2.5 bg-slate-900 text-white font-semibold rounded-xl hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
              >
                {submittingReview ? UI_CUSTOMER.SUBMITTING_RATING : UI_CUSTOMER.SUBMIT_RATING}
              </button>
            </form>
          ) : (
            <p className="text-sm text-slate-500">{UI_CUSTOMER.LABEL_NOT_RATED}</p>
          )}
        </div>
      </div>
    </div>
  );
}

export const AppointmentDetailsCard = memo(AppointmentDetailsCardComponent);
