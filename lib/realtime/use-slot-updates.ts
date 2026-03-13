'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';
import {
  subscribeSlotUpdates,
  type SlotRealtimePayload,
  type SupabaseRealtime,
} from '@/lib/realtime/slot-updates';
import { createRealtimeMetrics, type RealtimeMetrics } from '@/lib/realtime/realtime-utils';
import type { Slot } from '@/types';
import { API_ROUTES } from '@/config/constants';

const MAX_SEEN_EVENT_IDS = 500;
const BATCH_DELAY_MS = 100;
const REFETCH_DEBOUNCE_MS = 2000;

export type UseSlotUpdatesOptions = {
  businessId: string | null;
  date: string | null;
  /** Current slots for the date (e.g. from parent state). */
  slots: Slot[];
  /** Called with merged slots after refetch or realtime update. Idempotent: same slots ref = no re-render if parent memoizes. */
  onSlotsUpdate: (slots: Slot[]) => void;
  /** Called when a specific slot changes (for surgical updates). */
  onSlotChange?: (slotId: string, slot: Slot) => void;
  /** Whether subscription is enabled (e.g. tab visible, component mounted). */
  enabled?: boolean;
  /** Skip refetch on initial subscription (if slots already loaded). */
  skipInitialRefetch?: boolean;
  /** Callback to receive metrics (for debugging/monitoring). */
  onMetricsUpdate?: (metrics: RealtimeMetrics) => void;
};

/**
 * Subscribe to real-time slot updates for a business. One channel per business_id.
 * On reconnect/subscribe: refetches latest slot state. Ignores duplicate events via event_id.
 * Merges realtime payloads into slots by slot id; calls onSlotsUpdate for idempotent client updates.
 * Uses batching to avoid excessive re-renders from rapid updates.
 */
export function useSlotUpdates(options: UseSlotUpdatesOptions): void {
  const {
    businessId,
    date,
    slots,
    onSlotsUpdate,
    onSlotChange,
    enabled = true,
    skipInitialRefetch = false,
    onMetricsUpdate,
  } = options;

  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const slotsRef = useRef<Slot[]>(slots);
  const pendingUpdatesRef = useRef<Map<string, Slot>>(new Map());
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefetchRef = useRef<number>(0);
  const initialSubscribeRef = useRef<boolean>(true);
  const metricsRef = useRef(createRealtimeMetrics());
  const isVisibleRef = useRef(!document.hidden);

  slotsRef.current = slots;

  const flushPendingUpdates = useCallback(() => {
    if (pendingUpdatesRef.current.size === 0) return;

    const current = slotsRef.current;
    const byId = new Map(current.map((s) => [s.id, s]));
    let hasChanges = false;

    pendingUpdatesRef.current.forEach((slot, id) => {
      const existing = byId.get(id);
      if (!existing || existing.status !== slot.status || existing.updated_at !== slot.updated_at) {
        byId.set(id, slot);
        hasChanges = true;
        if (onSlotChange) {
          onSlotChange(id, slot);
        }
      }
    });

    pendingUpdatesRef.current.clear();

    if (hasChanges) {
      const merged = Array.from(byId.values());
      onSlotsUpdate(merged);
    }
  }, [onSlotsUpdate, onSlotChange]);

  const scheduleBatchFlush = useCallback(() => {
    if (batchTimerRef.current) return;
    batchTimerRef.current = setTimeout(() => {
      batchTimerRef.current = null;
      flushPendingUpdates();
    }, BATCH_DELAY_MS);
  }, [flushPendingUpdates]);

  const refetch = useCallback(async () => {
    if (!businessId || !date) return;

    const now = Date.now();
    if (now - lastRefetchRef.current < REFETCH_DEBOUNCE_MS) {
      if (refetchTimerRef.current) clearTimeout(refetchTimerRef.current);
      refetchTimerRef.current = setTimeout(refetch, REFETCH_DEBOUNCE_MS);
      return;
    }

    lastRefetchRef.current = now;

    try {
      const res = await fetch(`${API_ROUTES.SLOTS}?salon_id=${businessId}&date=${date}`, {
        credentials: 'include',
      });
      const result = await res.json();
      if (result?.success && result?.data && !result.data.closed) {
        const next = Array.isArray(result.data) ? result.data : (result.data.slots ?? []);

        const current = slotsRef.current;
        const currentById = new Map(current.map((s) => [s.id, s]));
        let hasChanges = false;

        for (const slot of next) {
          const existing = currentById.get(slot.id);
          if (
            !existing ||
            existing.status !== slot.status ||
            existing.updated_at !== slot.updated_at
          ) {
            hasChanges = true;
            break;
          }
        }

        if (hasChanges || next.length !== current.length) {
          onSlotsUpdate(next);
        }

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

    const metrics = metricsRef.current;
    initialSubscribeRef.current = true;
    metrics.setStatus('connecting');

    const handlePayload = (payload: SlotRealtimePayload): void => {
      const isDuplicate = seenEventIdsRef.current.has(payload.eventId);
      metrics.recordEvent(!isDuplicate);

      if (isDuplicate) return;
      seenEventIdsRef.current.add(payload.eventId);

      if (!isVisibleRef.current) {
        pendingUpdatesRef.current.set(payload.slot.id, payload.slot);
        return;
      }

      pendingUpdatesRef.current.set(payload.slot.id, payload.slot);
      scheduleBatchFlush();

      if (onMetricsUpdate) {
        onMetricsUpdate(metrics.metrics);
      }
    };

    const handleRefetch = () => {
      metrics.recordReconnect();
      metrics.setStatus('connected');

      if (skipInitialRefetch && initialSubscribeRef.current) {
        initialSubscribeRef.current = false;
        return;
      }
      initialSubscribeRef.current = false;

      if (isVisibleRef.current) {
        refetch();
      }
    };

    const handleVisibilityChange = () => {
      isVisibleRef.current = !document.hidden;

      if (!document.hidden && pendingUpdatesRef.current.size > 0) {
        scheduleBatchFlush();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    const unsubscribe = subscribeSlotUpdates({
      businessId,
      dateFilter: date,
      onPayload: handlePayload,
      onRefetch: handleRefetch,
      supabase: supabase as unknown as SupabaseRealtime,
    });

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      unsubscribe();
      metrics.setStatus('disconnected');

      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
      if (refetchTimerRef.current) {
        clearTimeout(refetchTimerRef.current);
        refetchTimerRef.current = null;
      }
      flushPendingUpdates();
    };
  }, [
    enabled,
    businessId,
    date,
    scheduleBatchFlush,
    refetch,
    skipInitialRefetch,
    flushPendingUpdates,
    onMetricsUpdate,
  ]);
}
