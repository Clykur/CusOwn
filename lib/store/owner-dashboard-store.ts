'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BookingWithDetails } from '@/types';

interface DashboardStats {
  totalBusinesses: number;
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
}

type FilteredBookingsCache = {
  key: string;
  result: BookingWithDetails[];
};

interface OwnerDashboardState {
  stats: DashboardStats | null;
  bookings: BookingWithDetails[];
  fromDate: string;
  toDate: string;
  searchTerm: string;
  processingBookingId: string | null;
  isLoading: boolean;
  isRefreshing: boolean;
  lastFetchedAt: number | null;

  setStats: (stats: DashboardStats | null) => void;
  setBookings: (bookings: BookingWithDetails[]) => void;
  updateBooking: (bookingId: string, updates: Partial<BookingWithDetails>) => void;
  setFromDate: (date: string) => void;
  setToDate: (date: string) => void;
  setDateRange: (from: string, to: string) => void;
  setSearchTerm: (term: string) => void;
  setProcessingBookingId: (id: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsRefreshing: (refreshing: boolean) => void;
  setLastFetchedAt: (timestamp: number) => void;
  clearFilters: () => void;
  reset: () => void;
}

const CACHE_TTL_MS = 30_000;

const initialState = {
  stats: null,
  bookings: [],
  fromDate: '',
  toDate: '',
  searchTerm: '',
  processingBookingId: null,
  isLoading: true,
  isRefreshing: false,
  lastFetchedAt: null,
};

export const useOwnerDashboardStore = create<OwnerDashboardState>()(
  persist(
    (set, get) => ({
      ...initialState,

      setStats: (stats) => set({ stats }),

      setBookings: (bookings) => set({ bookings }),

      updateBooking: (bookingId, updates) =>
        set((state) => ({
          bookings: state.bookings.map((b) => (b.id === bookingId ? { ...b, ...updates } : b)),
        })),

      setFromDate: (fromDate) => set({ fromDate }),

      setToDate: (toDate) => set({ toDate }),

      setDateRange: (fromDate, toDate) => set({ fromDate, toDate }),

      setSearchTerm: (searchTerm) => set({ searchTerm }),

      setProcessingBookingId: (processingBookingId) => set({ processingBookingId }),

      setIsLoading: (isLoading) => set({ isLoading }),

      setIsRefreshing: (isRefreshing) => set({ isRefreshing }),

      setLastFetchedAt: (lastFetchedAt) => set({ lastFetchedAt }),

      clearFilters: () => set({ fromDate: '', toDate: '', searchTerm: '' }),

      reset: () => set(initialState),
    }),
    {
      name: 'owner-dashboard-store',
      partialize: (state) => ({
        fromDate: state.fromDate,
        toDate: state.toDate,
      }),
    }
  )
);

let filteredBookingsCache: FilteredBookingsCache | null = null;

export const selectFilteredBookings = (state: OwnerDashboardState) => {
  const { bookings, searchTerm } = state;
  const cacheKey = `${bookings.length}-${searchTerm}`;

  if (filteredBookingsCache?.key === cacheKey) {
    return filteredBookingsCache.result;
  }

  if (!searchTerm.trim()) {
    filteredBookingsCache = { key: cacheKey, result: bookings };
    return bookings;
  }

  const term = searchTerm.toLowerCase();
  const result = bookings.filter(
    (booking) =>
      booking.customer_name?.toLowerCase().includes(term) ||
      booking.customer_phone?.toLowerCase().includes(term) ||
      booking.booking_id?.toLowerCase().includes(term) ||
      booking.salon?.salon_name?.toLowerCase().includes(term)
  );

  filteredBookingsCache = { key: cacheKey, result };
  return result;
};

export const selectHasValidCache = (state: OwnerDashboardState) => {
  if (!state.stats || !state.lastFetchedAt) return false;
  return Date.now() - state.lastFetchedAt < CACHE_TTL_MS;
};

export const selectBookingCounts = (state: OwnerDashboardState) => {
  const { bookings } = state;
  return {
    total: bookings.length,
    pending: bookings.filter((b) => b.status === 'pending').length,
    confirmed: bookings.filter((b) => b.status === 'confirmed').length,
    cancelled: bookings.filter((b) => b.status === 'cancelled').length,
    rejected: bookings.filter((b) => b.status === 'rejected').length,
  };
};

export type { DashboardStats, OwnerDashboardState };
