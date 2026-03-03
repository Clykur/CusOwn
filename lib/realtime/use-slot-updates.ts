'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  subscribeSlotUpdates,
  type SlotRealtimePayload,
  type SupabaseRealtime,
} from '@/lib/realtime/slot-updates';
import type { Slot } from '@/types';
import { API_ROUTES } from '@/config/constants';

const MAX_SEEN_EVENT_IDS = 500;

export type UseSlotUpdatesOptions = {
  businessId: string | null;
  date: string | null;
  /** Current slots for the date (e.g. from parent state). */
  slots: Slot[];
  /** Called with merged slots after refetch or realtime update. Idempotent: same slots ref = no re-render if parent memoizes. */
  onSlotsUpdate: (slots: Slot[]) => void;
  /** Whether subscription is enabled (e.g. tab visible, component mounted). */
  enabled?: boolean;
};

/**
 * Subscribe to real-time slot updates for a business. One channel per business_id.
 * On reconnect/subscribe: refetches latest slot state. Ignores duplicate events via event_id.
 * Merges realtime payloads into slots by slot id; calls onSlotsUpdate for idempotent client updates.
 */
export function useSlotUpdates(options: UseSlotUpdatesOptions): void {
  const { businessId, date, slots, onSlotsUpdate, enabled = true } = options;

  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const slotsRef = useRef<Slot[]>(slots);
  slotsRef.current = slots;

  const refetch = useCallback(async () => {
    if (!businessId || !date) return;
    try {
      const res = await fetch(`${API_ROUTES.SLOTS}?salon_id=${businessId}&date=${date}`, {
        credentials: 'include',
      });
      const result = await res.json();
      if (result?.success && result?.data && !result.data.closed) {
        const next = Array.isArray(result.data) ? result.data : (result.data.slots ?? []);
        onSlotsUpdate(next);
        if (seenEventIdsRef.current.size > MAX_SEEN_EVENT_IDS) {
          seenEventIdsRef.current.clear();
        }
      }
    } catch {
      // Non-fatal: keep current slots
    }
  }, [businessId, date, onSlotsUpdate]);

  useEffect(() => {
    if (!enabled || !businessId) return;

    const handlePayload = (payload: SlotRealtimePayload): void => {
      if (seenEventIdsRef.current.has(payload.eventId)) return;
      seenEventIdsRef.current.add(payload.eventId);

      const current = slotsRef.current;
      const byId = new Map(current.map((s) => [s.id, s]));
      byId.set(payload.slot.id, payload.slot);
      const merged = Array.from(byId.values());
      onSlotsUpdate(merged);
    };

    const unsubscribe = subscribeSlotUpdates({
      businessId,
      dateFilter: date,
      onPayload: handlePayload,
      onRefetch: refetch,
      supabase: supabase as unknown as SupabaseRealtime,
    });

    return () => {
      unsubscribe();
    };
  }, [enabled, businessId, date, onSlotsUpdate, refetch]);
}
