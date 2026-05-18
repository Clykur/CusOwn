'use client';

import { useRouter } from 'next/navigation';
import StarRating from '@/components/booking/star-rating';
import { useRating } from '@/components/customer/booking-card/use-rating';

interface BookingRowRatingProps {
  bookingId: string;
  existingRating?: number;
  canRate: boolean;
}

export default function BookingRowRating({
  bookingId,
  existingRating,
  canRate,
}: BookingRowRatingProps) {
  const router = useRouter();

  const { displayedRating, submittingRating, handleRating } = useRating({
    bookingId,
    existingRating,
    onRated: () => {
      router.refresh();
    },
  });

  if (existingRating || displayedRating) {
    return <StarRating value={displayedRating || existingRating || 0} readonly size="sm" />;
  }

  if (!canRate) {
    return <span className="text-slate-400 text-xs">Not rated</span>;
  }

  return (
    <div className="flex items-center gap-2">
      <StarRating value={0} readonly={submittingRating} size="sm" onChange={handleRating} />
    </div>
  );
}
