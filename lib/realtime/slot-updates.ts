/**
 * Real-time slot updates via Supabase Realtime (postgres_changes on slots table).
 * One channel per business_id; clients subscribe when viewing business slots.
 * Event types: slot_reserved | slot_confirmed | slot_released.
 * Deduplication via event_id (slot_id + updated_at).
 */

import type { Slot } from '@/types';
import { SLOT_STATUS } from '@/config/constants';

export type SlotUpdateEventType = 'slot_reserved' | 'slot_confirmed' | 'slot_released';

export type SlotRealtimePayload = {
  eventType: SlotUpdateEventType;
  slot: Slot;
  eventId: string;
};

function slotRowToSlot(row: Record<string, unknown>): Slot {
  return {
    id: String(row.id),
    business_id: String(row.business_id),
    date: String(row.date),
    start_time: String(row.start_time),
    end_time: String(row.end_time),
    status: (row.status as Slot['status']) ?? SLOT_STATUS.AVAILABLE,
    reserved_until: row.reserved_until != null ? String(row.reserved_until) : null,
    created_at: String(row.created_at),
    updated_at: row.updated_at != null ? String(row.updated_at) : null,
  };
}

function statusToEventType(status: string): SlotUpdateEventType {
  if (status === SLOT_STATUS.RESERVED) return 'slot_reserved';
  if (status === SLOT_STATUS.BOOKED) return 'slot_confirmed';
  if (status === SLOT_STATUS.AVAILABLE) return 'slot_released';
  return 'slot_reserved';
}

/** Build event_id for deduplication (reconnect may replay same change). */
export function slotEventId(slotId: string, updatedAt: string | null): string {
  return `${slotId}:${updatedAt ?? ''}`;
}

export type SupabaseRealtime = {
  channel: (name: string) => {
    on: (
      event: 'postgres_changes',
      config: { event: string; schema: string; table: string; filter?: string },
      callback: (payload: unknown) => void
    ) => { subscribe: (cb?: (status: string) => void) => void };
    unsubscribe: () => Promise<'ok' | 'timed out' | 'error'>;
  };
};

export type SubscribeSlotUpdatesOptions = {
  businessId: string;
  /** Optional: only apply updates for this date (YYYY-MM-DD). */
  dateFilter?: string | null;
  onPayload: (payload: SlotRealtimePayload) => void;
  onRefetch: () => void;
  supabase: SupabaseRealtime;
};

/**
 * Subscribe to slot changes for a business. Caller must invoke the returned unsubscribe.
 * On SUBSCRIBED status, onRefetch() is called so client can load latest state (graceful reconnect).
 */
export function subscribeSlotUpdates(options: SubscribeSlotUpdatesOptions): () => void {
  const { businessId, dateFilter, onPayload, onRefetch, supabase } = options;

  const channelName = `slots:${businessId}`;
  const channel = supabase.channel(channelName);

  const handler = (payload: unknown): void => {
    const p = payload as {
      new?: Record<string, unknown>;
      old?: Record<string, unknown>;
    };
    const newRow = p?.new;
    if (!newRow || typeof newRow !== 'object') return;

    const slot = slotRowToSlot(newRow);
    if (dateFilter != null && slot.date !== dateFilter) return;

    const updatedAt = slot.updated_at ?? slot.created_at;
    const eventId = slotEventId(slot.id, updatedAt);
    const eventType = statusToEventType(slot.status);

    onPayload({ eventType, slot, eventId });
  };

  let lastRefetchTime = 0;
  const RECONNECT_REFETCH_DEBOUNCE_MS = 10000;

  channel
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'slots',
        filter: `business_id=eq.${businessId}`,
      },
      handler
    )
    .subscribe((status) => {
      if (status === 'SUBSCRIBED' || status === 'CHANNEL_RECONNECTED') {
        const now = Date.now();
        if (now - lastRefetchTime < RECONNECT_REFETCH_DEBOUNCE_MS) {
          return;
        }
        lastRefetchTime = now;
        onRefetch();
      }
    });

  return () => {
    void channel.unsubscribe();
  };
}
