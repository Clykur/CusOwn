'use client';

import { memo } from 'react';
import StarRating from '@/components/booking/star-rating';

export interface ReviewData {
  rating_avg: number;
  review_count: number;
  rating_counts: Record<number, number>;
}

interface ReviewSummaryProps {
  reviewData: ReviewData | null;
}

function ReviewSummaryComponent({ reviewData }: ReviewSummaryProps) {
  if (!reviewData || (reviewData.rating_avg === 0 && reviewData.review_count === 0)) {
    return (
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 lg:p-6 shadow-sm ring-1 ring-slate-100/80">
        <h2 className="text-lg font-semibold text-slate-900 mb-4">Customer Reviews</h2>
        <div className="flex flex-col items-center justify-center min-h-[120px] text-center">
          <div className="flex items-center gap-1 mb-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <svg
                key={i}
                className="w-5 h-5 text-slate-300"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.963a1 1 0 00.95.69h4.167c.969 0 1.371 1.24.588 1.81l-3.373 2.451a1 1 0 00-.364 1.118l1.287 3.963c.3.921-.755 1.688-1.54 1.118l-3.373-2.452a1 1 0 00-1.175 0l-3.373 2.452c-.784.57-1.838-.197-1.539-1.118l1.286-3.963a1 1 0 00-.364-1.118L2.09 9.39c-.783-.57-.38-1.81.588-1.81h4.167a1 1 0 00.95-.69l1.254-3.963z" />
              </svg>
            ))}
          </div>
          <p className="text-sm text-slate-500">No reviews yet.</p>
        </div>
      </div>
    );
  }

  const { rating_avg, review_count, rating_counts } = reviewData;

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-5 lg:p-6 shadow-sm ring-1 ring-slate-100/80">
      <h2 className="text-lg font-semibold text-slate-900 mb-4">Customer Reviews</h2>

      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <div className="flex flex-col items-center sm:items-start sm:min-w-[120px]">
          <div className="text-4xl font-bold leading-none text-slate-900">
            {rating_avg.toFixed(1)}
          </div>

          {/* Pass decimal rating directly, do not round */}
          <div className="mt-2">
            <StarRating value={rating_avg} readonly size="md" />
          </div>

          <p className="mt-1 text-sm text-slate-500">
            {review_count} review{review_count === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex-1 space-y-2">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = rating_counts?.[star] ?? 0;
            const percent = review_count > 0 ? (count / review_count) * 100 : 0;

            return (
              <div key={star} className="flex items-center gap-3">
                <span className="flex w-8 items-center gap-1 text-sm text-slate-600">
                  {star}
                  <svg
                    className="w-4 h-4 text-amber-400"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                    aria-hidden="true"
                  >
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.963a1 1 0 00.95.69h4.167c.969 0 1.371 1.24.588 1.81l-3.373 2.451a1 1 0 00-.364 1.118l1.287 3.963c.3.921-.755 1.688-1.54 1.118l-3.373-2.452a1 1 0 00-1.175 0l-3.373 2.452c-.784.57-1.838-.197-1.539-1.118l1.286-3.963a1 1 0 00-.364-1.118L2.09 9.39c-.783-.57-.38-1.81.588-1.81h4.167a1 1 0 00.95-.69l1.254-3.963z" />
                  </svg>
                </span>

                <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-amber-400 transition-all"
                    style={{ width: `${percent}%` }}
                    aria-hidden="true"
                  />
                </div>

                <span className="w-8 text-right text-xs text-slate-500">{count}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export const ReviewSummary = memo(ReviewSummaryComponent);
export default ReviewSummary;
