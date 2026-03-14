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
import { isSupabaseConfigured } from '@/config/env';

const MAX_SEEN_EVENT_IDS = 500;
const BATCH_DELAY_MS = 100;
const REFETCH_DEBOUNCE_MS = 5000;
const MAX_REFETCH_COUNT = 3;

export type UseSlotUpdatesOptions = {
  businessId: string | null;
  date: string | null;
  slots: Slot[];
  onSlotsUpdate: (slots: Slot[]) => void;
  onSlotChange?: (slotId: string, slot: Slot) => void;
  enabled?: boolean;
  skipInitialRefetch?: boolean;
  onMetricsUpdate?: (metrics: RealtimeMetrics) => void;
};

/**
 * Subscribe to real-time slot updates for a business.
 * Stable subscription - won't recreate on callback changes.
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

  // Use refs for all values that shouldn't trigger re-subscription
  const slotsRef = useRef<Slot[]>(slots);
  const onSlotsUpdateRef = useRef(onSlotsUpdate);
  const onSlotChangeRef = useRef(onSlotChange);
  const onMetricsUpdateRef = useRef(onMetricsUpdate);
  const skipInitialRefetchRef = useRef(skipInitialRefetch);

  // Keep refs up to date without triggering effects
  slotsRef.current = slots;
  onSlotsUpdateRef.current = onSlotsUpdate;
  onSlotChangeRef.current = onSlotChange;
  onMetricsUpdateRef.current = onMetricsUpdate;
  skipInitialRefetchRef.current = skipInitialRefetch;

  const seenEventIdsRef = useRef<Set<string>>(new Set());
  const pendingUpdatesRef = useRef<Map<string, Slot>>(new Map());
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const refetchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastRefetchRef = useRef<number>(0);
  const refetchCountRef = useRef<number>(0);
  const initialSubscribeRef = useRef<boolean>(true);
  const metricsRef = useRef(createRealtimeMetrics());
  const isVisibleRef = useRef<boolean>(true);
  const isSubscribedRef = useRef<boolean>(false);

  // Set initial visibility state after mount (SSR-safe)
  useEffect(() => {
    if (typeof document !== 'undefined') {
      isVisibleRef.current = !document.hidden;
    }
  }, []);

  // Stable flush function using refs
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
        onSlotChangeRef.current?.(id, slot);
      }
    });

    pendingUpdatesRef.current.clear();

    if (hasChanges) {
      const merged = Array.from(byId.values());
      onSlotsUpdateRef.current(merged);
    }
  }, []);

  const scheduleBatchFlush = useCallback(() => {
    if (batchTimerRef.current) return;
    batchTimerRef.current = setTimeout(() => {
      batchTimerRef.current = null;
      flushPendingUpdates();
    }, BATCH_DELAY_MS);
  }, [flushPendingUpdates]);

  // Main subscription effect - only depends on businessId, date, and enabled
  useEffect(() => {
    if (!enabled || !businessId) return;

    // Skip realtime when Supabase is not configured (placeholder URL)
    if (!isSupabaseConfigured()) {
      return;
    }

    // Prevent multiple subscriptions
    if (isSubscribedRef.current) return;
    isSubscribedRef.current = true;

    const metrics = metricsRef.current;
    initialSubscribeRef.current = true;
    refetchCountRef.current = 0;
    metrics.setStatus('connecting');

    const refetch = async () => {
      const currentDate = date;
      if (!businessId || !currentDate) return;

      const now = Date.now();
      if (now - lastRefetchRef.current < REFETCH_DEBOUNCE_MS) {
        return;
      }

      // Limit refetch attempts to prevent infinite loops
      if (refetchCountRef.current >= MAX_REFETCH_COUNT) {
        return;
      }

      refetchCountRef.current++;
      lastRefetchRef.current = now;

      try {
        const res = await fetch(`${API_ROUTES.SLOTS}?salon_id=${businessId}&date=${currentDate}`, {
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
            onSlotsUpdateRef.current(next);
          }

          if (seenEventIdsRef.current.size > MAX_SEEN_EVENT_IDS) {
            seenEventIdsRef.current.clear();
          }
        }
      } catch {
        // Non-fatal: keep current slots
      }
    };

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

      onMetricsUpdateRef.current?.(metrics.metrics);
    };

    const handleRefetch = () => {
      metrics.recordReconnect();
      metrics.setStatus('connected');

      if (skipInitialRefetchRef.current && initialSubscribeRef.current) {
        initialSubscribeRef.current = false;
        return;
      }
      initialSubscribeRef.current = false;

      if (isVisibleRef.current) {
        refetch();
      }
    };

    const handleVisibilityChange = () => {
      if (typeof document === 'undefined') return;
      isVisibleRef.current = !document.hidden;

      if (!document.hidden && pendingUpdatesRef.current.size > 0) {
        scheduleBatchFlush();
      }
    };

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    const unsubscribe = subscribeSlotUpdates({
      businessId,
      dateFilter: date,
      onPayload: handlePayload,
      onRefetch: handleRefetch,
      supabase: supabase as unknown as SupabaseRealtime,
    });

    return () => {
      isSubscribedRef.current = false;
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
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
  }, [enabled, businessId, date, scheduleBatchFlush, flushPendingUpdates]);
}
