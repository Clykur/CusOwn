'use client';

import { memo, useState, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { UI_CUSTOMER, ERROR_MESSAGES } from '@/config/constants';
import { ROUTES } from '@/lib/utils/navigation';
import { getCSRFToken, clearCSRFToken } from '@/lib/utils/csrf-client';
import { useOptimisticMutation } from '@/lib/hooks/use-optimistic-action';
import { Slot } from '@/types';
import BookingsIcon from '@/src/icons/bookings.svg';

const RescheduleButton = dynamic(() => import('@/components/booking/reschedule-button'), {
  ssr: false,
  loading: () => (
    <button
      disabled
      className="flex-1 py-3 px-4 rounded-xl font-medium bg-slate-100 text-slate-400 cursor-not-allowed"
    >
      Loading...
    </button>
  ),
});

interface BookingSlot {
  id: string;
  business_id: string;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  created_at: string;
}

interface BookingActionsProps {
  booking: {
    id: string;
    status: string;
    no_show?: boolean;
    slot?: BookingSlot;
    salon?: { id: string };
    business_id: string;
  };
  availableSlots: Slot[];
  cancellationMinHoursMs: number;
  onCancelled: () => void;
  onRescheduled: () => void;
}

function BookingActionsComponent({
  booking,
  availableSlots,
  cancellationMinHoursMs,
  onCancelled,
  onRescheduled,
}: BookingActionsProps) {
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);

  const canCancelByStatus = booking.status === 'confirmed' || booking.status === 'pending';

  const appointmentDateTime = (() => {
    if (!booking?.slot?.date || !booking?.slot?.start_time) return null;
    const startTimeRaw = String(booking.slot.start_time);
    const startTime = startTimeRaw.includes('T')
      ? new Date(startTimeRaw)
      : new Date(`${booking.slot.date}T${startTimeRaw}`);
    const timeMs = startTime.getTime();
    if (!Number.isFinite(timeMs)) return null;
    return startTime;
  })();

  const msUntilAppointment = appointmentDateTime
    ? appointmentDateTime.getTime() - Date.now()
    : Number.POSITIVE_INFINITY;

  const isCancellationTooLate =
    canCancelByStatus &&
    Number.isFinite(msUntilAppointment) &&
    msUntilAppointment < cancellationMinHoursMs;

  const cancelMutation = useOptimisticMutation({
    mutationFn: async () => {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ cancelled_by: 'customer' }),
      });

      const result = await response.json();
      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel booking');
      }
      return result;
    },
    onMutate: () => {
      setOptimisticStatus('cancelled');
    },
    onSuccess: () => {
      onCancelled();
    },
    onError: () => {
      setOptimisticStatus(null);
      clearCSRFToken();
    },
  });

  const handleCancel = useCallback(async () => {
    if (cancelMutation.isPending) return;
    if (isCancellationTooLate) return;
    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await cancelMutation.mutate(undefined);
    } catch {
      // Error handled in onError
    }
  }, [cancelMutation, isCancellationTooLate]);

  const displayStatus = optimisticStatus || booking.status;
  const showCancelled = displayStatus === 'cancelled';

  return (
    <>
      {showCancelled ? (
        <div className="mb-6 p-4 bg-slate-100 rounded-xl text-center">
          <p className="text-slate-600 font-medium">
            {cancelMutation.isPending ? 'Cancelling your booking...' : 'Booking cancelled'}
          </p>
        </div>
      ) : (
        canCancelByStatus && (
          <div className="mb-6 space-y-3">
            <button
              type="button"
              onClick={handleCancel}
              disabled={cancelMutation.isPending || isCancellationTooLate}
              title={isCancellationTooLate ? ERROR_MESSAGES.CANCELLATION_TOO_LATE : undefined}
              className="w-full bg-red-600 text-white font-semibold py-3 px-6 rounded-xl hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {cancelMutation.isPending ? 'Cancelling...' : 'Cancel Booking'}
            </button>
            {cancelMutation.isError && (
              <p className="text-sm text-red-600">{cancelMutation.error?.message}</p>
            )}
            {isCancellationTooLate && (
              <p className="text-sm text-slate-500">{ERROR_MESSAGES.CANCELLATION_TOO_LATE}</p>
            )}
            {booking.slot && booking.salon && availableSlots.length > 0 && !booking.no_show && (
              <div className="flex justify-center">
                <RescheduleButton
                  bookingId={booking.id}
                  currentSlot={booking.slot as Slot}
                  businessId={booking.business_id}
                  availableSlots={availableSlots}
                  onRescheduled={onRescheduled}
                  rescheduledBy="customer"
                />
              </div>
            )}
          </div>
        )
      )}

      <div className="flex flex-col sm:flex-row gap-3 pt-6 border-t border-slate-200">
        <Link
          href={ROUTES.CUSTOMER_DASHBOARD}
          className="flex-1 inline-flex items-center justify-center gap-2 text-center bg-slate-100 text-slate-800 font-semibold py-3 px-6 rounded-xl hover:bg-slate-200 transition-all"
        >
          <BookingsIcon className="w-5 h-5" aria-hidden="true" />
          {UI_CUSTOMER.NAV_MY_ACTIVITY}
        </Link>
      </div>
    </>
  );
}

export const BookingActions = memo(BookingActionsComponent);
