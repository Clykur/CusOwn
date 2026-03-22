'use client';

import { useEffect, useState, useCallback } from 'react';
import { useCustomerSession } from '@/components/customer/customer-session-context';
import { RatingModal } from './rating-modal';
import type { PendingRatingBooking } from '@/services/rating-prompt.service';

/**
 * Checks for pending ratings and displays modal if user has unrated bookings.
 * Automatically fetches the next pending booking after user submits or ignores.
 */
export function RatingPromptProvider() {
  const { initialUser: user } = useCustomerSession();
  const [pendingBooking, setPendingBooking] = useState<PendingRatingBooking | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchPendingRating = useCallback(async () => {
    if (!user?.id) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/reviews/pending-rating');
      if (response.ok) {
        const data = await response.json();
        setPendingBooking(data.booking);
      }
    } catch (error) {
      console.error('[RATING PROMPT] Error fetching pending rating:', error);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  // Fetch pending rating on mount and when user changes
  useEffect(() => {
    fetchPendingRating();
  }, [fetchPendingRating]);

  const handleModalClose = () => {
    // Close the modal without submitting or ignoring
    // User can trigger it again by refreshing
    setPendingBooking(null);
  };

  const handleSuccess = () => {
    // After user submits or ignores, fetch the next pending booking
    fetchPendingRating();
  };

  if (!user || isLoading || !pendingBooking) {
    return null;
  }

  return (
    <RatingModal booking={pendingBooking} onClose={handleModalClose} onSuccess={handleSuccess} />
  );
}
