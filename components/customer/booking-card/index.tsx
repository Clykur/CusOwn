'use client';

import { memo, useMemo } from 'react';
import { UI_CUSTOMER } from '@/config/constants';
import { useRating } from './use-rating';
import { BookingCardHeader } from './booking-card-header';
import { BookingCardDetails } from './booking-card-details';
import { BookingCardRating } from './booking-card-rating';
import { BookingCardActions } from './booking-card-actions';
import type { Booking, SalonData } from './types';

interface CustomerBookingCardProps {
  booking: Booking;
  onRated?: () => void;
}

function CustomerBookingCardComponent({ booking, onRated }: CustomerBookingCardProps) {
  const {
    submittingRating,
    pendingRating,
    optimisticRating,
    ratingSuccess,
    displayedRating,
    handleRating,
  } = useRating({
    bookingId: booking.id,
    existingRating: booking.review?.rating,
    onRated,
  });

  const salonData: SalonData = useMemo(() => {
    const salon = booking.salon || booking.business;
    return {
      providerName: salon?.salon_name || UI_CUSTOMER.PROVIDER_FALLBACK,
      location: salon?.location || '',
      ownerName: salon?.owner_name?.trim() || 'Owner',
      ownerPhone: salon?.whatsapp_number || '',
      ownerImage: UI_CUSTOMER.DEFAULT_AVATAR_DATA_URI,
      bookingLink: salon?.booking_link || '',
      ratingAvg: salon?.rating_avg,
      reviewCount: salon?.review_count ?? 0,
    };
  }, [booking.salon, booking.business]);

  const hasReview = !!(booking.review || optimisticRating);
  const isConfirmed = booking.status === 'confirmed';

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-sm transition">
      {/* MOBILE VIEW */}
      <div className="md:hidden p-4 space-y-4">
        <BookingCardHeader salonData={salonData} variant="mobile" />

        {booking.slot && (
          <BookingCardDetails slot={booking.slot} bookingId={booking.booking_id} variant="mobile" />
        )}

        {booking.slot && (
          <BookingCardRating
            hasReview={hasReview}
            isConfirmed={isConfirmed}
            displayedRating={displayedRating}
            pendingRating={pendingRating}
            submittingRating={submittingRating}
            ratingSuccess={ratingSuccess}
            onRating={handleRating}
            variant="mobile"
          />
        )}

        <div className="pt-3 mt-2 border-t border-slate-200">
          <BookingCardActions
            bookingId={booking.booking_id}
            bookingLink={salonData.bookingLink}
            customerName={booking.customer_name}
            customerPhone={booking.customer_phone}
          />
        </div>
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden md:block p-4 md:p-6 space-y-4">
        <BookingCardHeader salonData={salonData} variant="desktop" />

        {booking.slot && (
          <div className="grid grid-cols-4 gap-4">
            <BookingCardDetails
              slot={booking.slot}
              bookingId={booking.booking_id}
              variant="desktop"
            />
            <BookingCardRating
              hasReview={hasReview}
              isConfirmed={isConfirmed}
              displayedRating={displayedRating}
              pendingRating={pendingRating}
              submittingRating={submittingRating}
              ratingSuccess={ratingSuccess}
              onRating={handleRating}
              variant="desktop"
            />
          </div>
        )}

        <BookingCardActions
          bookingId={booking.booking_id}
          bookingLink={salonData.bookingLink}
          customerName={booking.customer_name}
          customerPhone={booking.customer_phone}
        />
      </div>
    </div>
  );
}

const CustomerBookingCard = memo(CustomerBookingCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.booking.id === nextProps.booking.id &&
    prevProps.booking.status === nextProps.booking.status &&
    prevProps.booking.no_show === nextProps.booking.no_show &&
    prevProps.booking.review?.rating === nextProps.booking.review?.rating
  );
});

export default CustomerBookingCard;
export type { CustomerBookingCardProps, Booking, SalonData };
