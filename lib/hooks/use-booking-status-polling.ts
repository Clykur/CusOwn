import { useEffect, useRef, useState, useCallback } from 'react';
import { pollWithRetry } from '@/lib/resilience/poll-with-retry';
import {
  ADMIN_FETCH_MAX_RETRIES,
  BOOKING_STATUS,
  BOOKING_STATUS_POLL_INTERVAL_MS,
  CLIENT_RETRY_BACKOFF_MS,
} from '@/config/constants';

const TERMINAL_STATUSES = new Set<string>([BOOKING_STATUS.CANCELLED, BOOKING_STATUS.REJECTED]);

type BookingLike = {
  status: string;
  slot?: {
    id?: string;
    date?: string;
    start_time?: string | Date;
    end_time?: string | Date;
  };
};

export type BookingTransitionType =
  | 'pending_to_confirmed'
  | 'confirmed_to_cancelled'
  | 'confirmed_to_rescheduled';

export type BookingTransitionEvent<TBooking extends BookingLike> = {
  type: BookingTransitionType;
  previous: TBooking;
  current: TBooking;
};

export type UseBookingStatusPollingOptions<TBooking extends BookingLike> = {
  bookingId?: string;
  booking: TBooking | null;
  /** Function that refreshes the booking from the backend (e.g. calling fetchBooking({ silent: true })). */
  refresh: () => Promise<void> | void;
  /** Enable/disable polling. Defaults to true. */
  isEnabled?: boolean;
  /** Base polling interval in ms. Defaults to BOOKING_STATUS_POLL_INTERVAL_MS. */
  intervalMs?: number;
  /** Called when a significant booking status transition is detected. */
  onTransition?: (event: BookingTransitionEvent<TBooking>) => void;
};

const hasSlotChanged = (prev: BookingLike, next: BookingLike): boolean => {
  if (!prev.slot || !next.slot) return false;
  if (prev.slot.id && next.slot.id && prev.slot.id !== next.slot.id) return true;
  if (prev.slot.date !== next.slot.date) return true;
  if (String(prev.slot.start_time) !== String(next.slot.start_time)) return true;
  if (String(prev.slot.end_time) !== String(next.slot.end_time)) return true;
  return false;
};

export const useBookingStatusPolling = <TBooking extends BookingLike>(
  options: UseBookingStatusPollingOptions<TBooking>
) => {
  const {
    bookingId,
    booking,
    refresh,
    isEnabled = true,
    intervalMs = BOOKING_STATUS_POLL_INTERVAL_MS,
    onTransition,
  } = options;

  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<unknown>(null);

  const stopRef = useRef<(() => void) | null>(null);
  const previousBookingRef = useRef<TBooking | null>(booking);

  // Detect transitions and stop condition based on latest booking snapshot
  useEffect(() => {
    if (!booking) return;

    const prev = previousBookingRef.current;
    previousBookingRef.current = booking;

    if (prev) {
      let type: BookingTransitionType | null = null;

      if (prev.status === BOOKING_STATUS.PENDING && booking.status === BOOKING_STATUS.CONFIRMED) {
        type = 'pending_to_confirmed';
      } else if (
        prev.status === BOOKING_STATUS.CONFIRMED &&
        booking.status === BOOKING_STATUS.CANCELLED
      ) {
        type = 'confirmed_to_cancelled';
      } else if (
        prev.status === BOOKING_STATUS.CONFIRMED &&
        booking.status === BOOKING_STATUS.CONFIRMED &&
        hasSlotChanged(prev, booking)
      ) {
        type = 'confirmed_to_rescheduled';
      }

      if (type && onTransition) {
        onTransition({ type, previous: prev, current: booking });
      }
    }

    if (TERMINAL_STATUSES.has(booking.status)) {
      if (stopRef.current) {
        stopRef.current();
        stopRef.current = null;
      }
      setIsPolling(false);
    }
  }, [booking, onTransition]);

  const startPolling = useCallback(() => {
    if (stopRef.current) return;

    setIsPolling(true);
    setError(null);

    const controller = new AbortController();
    const handle = pollWithRetry<void>({
      fn: async () => {
        if (document.hidden) return;
        await Promise.resolve(refresh());
      },
      intervalMs,
      retryOptions: {
        maxAttempts: ADMIN_FETCH_MAX_RETRIES + 1,
        initialDelayMs: CLIENT_RETRY_BACKOFF_MS,
        maxDelayMs: CLIENT_RETRY_BACKOFF_MS * 4,
        backoffMultiplier: 2,
      },
      onError: (err) => {
        if (!controller.signal.aborted) {
          setError(err);
        }
      },
      signal: controller.signal,
    });

    stopRef.current = () => {
      controller.abort();
      handle.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intervalMs]);

  const stopPolling = useCallback(() => {
    if (stopRef.current) {
      stopRef.current();
      stopRef.current = null;
    }
    setIsPolling(false);
  }, []);

  useEffect(() => {
    if (!isEnabled || !bookingId) {
      stopPolling();
      return undefined;
    }

    startPolling();

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        startPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      stopPolling();
    };
  }, [bookingId, isEnabled, startPolling, stopPolling]);

  return { isPolling, error };
};
