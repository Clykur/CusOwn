'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useShallow } from 'zustand/react/shallow';

interface CustomerBooking {
  id: string;
  booking_id: string;
  business_id: string;
  status: 'pending' | 'confirmed' | 'rejected' | 'cancelled' | 'expired';
  customer_name: string;
  customer_phone: string;
  no_show?: boolean;
  slot?: {
    date: string;
    start_time: string;
    end_time: string;
  };
  salon?: {
    salon_name: string;
    owner_name: string;
    whatsapp_number: string;
    location?: string;
    booking_link: string;
    rating_avg?: number;
    review_count?: number;
  };
  review?: {
    rating: number;
  };
  created_at: string;
}

interface CustomerBookingsStats {
  total: number;
  upcoming: number;
  completed: number;
}

interface CustomerBookingsState {
  bookings: CustomerBooking[];
  isInitialLoad: boolean;
  isRefreshing: boolean;
  lastFetchedAt: number | null;

  setBookings: (bookings: CustomerBooking[]) => void;
  updateBooking: (bookingId: string, updates: Partial<CustomerBooking>) => void;
  setIsInitialLoad: (loading: boolean) => void;
  setIsRefreshing: (refreshing: boolean) => void;
  setLastFetchedAt: (timestamp: number) => void;
  reset: () => void;
}

const CACHE_TTL_MS = 30_000;

const initialState = {
  bookings: [],
  isInitialLoad: true,
  isRefreshing: false,
  lastFetchedAt: null,
};

export const useCustomerBookingsStore = create<CustomerBookingsState>()(
  persist(
    (set) => ({
      ...initialState,

      setBookings: (bookings) => set({ bookings }),

      updateBooking: (bookingId, updates) =>
        set((state) => ({
          bookings: state.bookings.map((b) => (b.id === bookingId ? { ...b, ...updates } : b)),
        })),

      setIsInitialLoad: (isInitialLoad) => set({ isInitialLoad }),

      setIsRefreshing: (isRefreshing) => set({ isRefreshing }),

      setLastFetchedAt: (lastFetchedAt) => set({ lastFetchedAt }),

      reset: () => set(initialState),
    }),
    {
      name: 'customer-bookings-store',
      partialize: (state) => ({
        bookings: state.bookings,
        lastFetchedAt: state.lastFetchedAt,
      }),
    }
  )
);

const computeStats = (bookings: CustomerBooking[]): CustomerBookingsStats => {
  let upcoming = 0;
  let completed = 0;

  for (const b of bookings) {
    if (b.status === 'confirmed' || b.status === 'pending') {
      upcoming++;
    } else if (b.status === 'cancelled' || b.status === 'rejected' || b.status === 'expired') {
      completed++;
    }
  }

  return {
    total: bookings.length,
    upcoming,
    completed,
  };
};

let cachedStats: CustomerBookingsStats | null = null;
let cachedBookingsRef: CustomerBooking[] | null = null;

export const selectBookingsStats = (state: CustomerBookingsState): CustomerBookingsStats => {
  if (cachedBookingsRef === state.bookings && cachedStats !== null) {
    return cachedStats;
  }
  cachedStats = computeStats(state.bookings);
  cachedBookingsRef = state.bookings;
  return cachedStats;
};

export function useBookingsStats(): CustomerBookingsStats {
  return useCustomerBookingsStore(useShallow((state) => selectBookingsStats(state)));
}

export const selectHasValidCache = (state: CustomerBookingsState): boolean => {
  if (!state.lastFetchedAt) return false;
  return Date.now() - state.lastFetchedAt < CACHE_TTL_MS;
};

export type { CustomerBooking, CustomerBookingsStats, CustomerBookingsState };
