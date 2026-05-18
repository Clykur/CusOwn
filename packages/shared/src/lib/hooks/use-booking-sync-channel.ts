import { useEffect, useRef } from 'react';

type BookingSyncEvent =
  | {
      type: 'BOOKING_UPDATED';
      bookingId: string;
      status?: string;
    }
  | {
      type: 'BOOKINGS_REFRESH';
    };

type UseBookingSyncChannelOptions = {
  /** Called when a booking is updated in another tab. */
  onBookingUpdated?: (event: Extract<BookingSyncEvent, { type: 'BOOKING_UPDATED' }>) => void;
  /** Called when a full refresh is requested from another tab. */
  onRefreshAll?: () => void;
  /** Channel name (namespace) for booking sync. Defaults to 'cusown-booking-sync'. */
  channelName?: string;
};

export const BOOKING_SYNC_CHANNEL_DEFAULT = 'cusown-booking-sync';

function createChannel(name: string): BroadcastChannel | null {
  if (typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') {
    return null;
  }
  try {
    return new BroadcastChannel(name);
  } catch {
    return null;
  }
}

export function useBookingSyncChannel(options: UseBookingSyncChannelOptions) {
  const { onBookingUpdated, onRefreshAll, channelName = BOOKING_SYNC_CHANNEL_DEFAULT } = options;
  const channelRef = useRef<BroadcastChannel | null>(null);

  useEffect(() => {
    const channel = createChannel(channelName);
    if (!channel) {
      return;
    }

    channelRef.current = channel;

    const handleMessage = (event: MessageEvent<BookingSyncEvent>) => {
      const data = event.data;
      if (!data || typeof data !== 'object' || !('type' in data)) return;

      if (data.type === 'BOOKING_UPDATED' && onBookingUpdated) {
        onBookingUpdated(data);
      }

      if (data.type === 'BOOKINGS_REFRESH' && onRefreshAll) {
        onRefreshAll();
      }
    };

    channel.addEventListener('message', handleMessage);

    return () => {
      channel.removeEventListener('message', handleMessage);
      channel.close();
      channelRef.current = null;
    };
  }, [channelName, onBookingUpdated, onRefreshAll]);

  const publishBookingUpdated = (bookingId: string, status?: string) => {
    const channel = channelRef.current;
    if (!channel) return;
    const payload: BookingSyncEvent = {
      type: 'BOOKING_UPDATED',
      bookingId,
      status,
    };
    channel.postMessage(payload);
  };

  const publishRefreshAll = () => {
    const channel = channelRef.current;
    if (!channel) return;
    const payload: BookingSyncEvent = {
      type: 'BOOKINGS_REFRESH',
    };
    channel.postMessage(payload);
  };

  return {
    publishBookingUpdated,
    publishRefreshAll,
  };
}
