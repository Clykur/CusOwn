'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useCustomerSession } from '@/components/customer/customer-session-context';
import { RatingModal } from './rating-modal';
import type { PendingRatingBooking } from '@/services/rating-prompt.service';

type PendingRatingApiResponse = {
  success?: boolean;
  data?: {
    booking?: PendingRatingBooking | null;
    bookings?: PendingRatingBooking[] | null;
  } | null;
  booking?: PendingRatingBooking | null;
  bookings?: PendingRatingBooking[] | null;
};

function normalizePendingBookingsResponse(
  response: PendingRatingApiResponse | null | undefined
): PendingRatingBooking[] {
  if (!response) return [];

  if (Array.isArray(response.data?.bookings)) {
    return response.data.bookings.filter(Boolean);
  }

  if (Array.isArray(response.bookings)) {
    return response.bookings.filter(Boolean);
  }

  const singleBooking = response.data?.booking ?? response.booking ?? null;
  return singleBooking ? [singleBooking] : [];
}

export function RatingPromptProvider() {
  const { initialUser: user } = useCustomerSession();

  const [pendingBookings, setPendingBookings] = useState<PendingRatingBooking[]>([]);
  const [dismissedBookingIds, setDismissedBookingIds] = useState<string[]>([]);
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const pendingBooking = pendingBookings[0] ?? null;

  const fetchPendingRating = useCallback(async () => {
    if (!user?.id) {
      setPendingBookings([]);
      return;
    }

    try {
      const response = await fetch('/api/reviews/pending-rating', {
        credentials: 'include',
        cache: 'no-store',
      });

      const data: PendingRatingApiResponse = await response.json();
      const bookings = normalizePendingBookingsResponse(data);

      const filtered = bookings.filter((booking) => !dismissedBookingIds.includes(booking.id));

      setPendingBookings(filtered);
    } catch (error) {
      console.error('[RATING PROMPT CLIENT] Error fetching pending rating:', error);
      setPendingBookings([]);
    }
  }, [user?.id, dismissedBookingIds]);

  useEffect(() => {
    fetchPendingRating();
  }, [fetchPendingRating]);

  useEffect(() => {
    if (!user?.id) return;

    pollIntervalRef.current = setInterval(fetchPendingRating, 30000);

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
        pollIntervalRef.current = null;
      }
    };
  }, [fetchPendingRating, user?.id]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && user?.id) {
        fetchPendingRating();
      }
    };

    const handleFocus = () => {
      if (user?.id) {
        fetchPendingRating();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchPendingRating, user?.id]);

  const handleModalClose = () => {
    if (!pendingBooking) return;

    setDismissedBookingIds((prev) => [...prev, pendingBooking.id]);
    setPendingBookings((prev) => prev.filter((b) => b.id !== pendingBooking.id));
  };

  const handleSuccess = () => {
    if (!pendingBooking) return;

    setPendingBookings((prev) => prev.filter((b) => b.id !== pendingBooking.id));
  };

  if (!user?.id || !pendingBooking) {
    return null;
  }

  return (
    <RatingModal
      key={pendingBooking.id}
      booking={pendingBooking}
      onClose={handleModalClose}
      onSuccess={handleSuccess}
    />
  );
}
