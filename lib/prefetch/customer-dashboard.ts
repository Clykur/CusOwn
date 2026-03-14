'use client';

import { useCustomerBookingsStore, selectCustomerHasValidCache } from '@/lib/store';
import { PREFETCH_DEBOUNCE_MS } from '@/config/constants';

let lastPrefetchTime = 0;

/**
 * Prefetch customer bookings after login.
 * Stores results in Zustand store for instant dashboard rendering.
 * Respects 30-second cache TTL and prevents duplicate prefetches.
 */
export async function prefetchCustomerDashboard(): Promise<boolean> {
  const now = Date.now();

  // Prevent rapid repeated prefetches
  if (now - lastPrefetchTime < PREFETCH_DEBOUNCE_MS) {
    return false;
  }

  // Check if we already have valid cache
  const state = useCustomerBookingsStore.getState();
  if (selectCustomerHasValidCache(state)) {
    return false;
  }

  lastPrefetchTime = now;

  try {
    const response = await fetch('/api/customer/bookings', {
      credentials: 'include',
      headers: {
        'x-prefetch': '1',
      },
    });

    if (!response.ok) {
      return false;
    }

    const result = await response.json();
    if (!result.success) {
      return false;
    }

    const bookingsData = result.data || [];

    // Store in Zustand - dashboard will read from here
    useCustomerBookingsStore.setState({
      bookings: bookingsData,
      lastFetchedAt: Date.now(),
      isInitialLoad: false,
      isRefreshing: false,
    });

    return true;
  } catch {
    return false;
  }
}

/**
 * Reset prefetch state (e.g., on logout).
 */
export function resetPrefetchState(): void {
  lastPrefetchTime = 0;
}
