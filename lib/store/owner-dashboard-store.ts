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
    (set) => ({
      ...initialState,

      setStats: (stats) => set({ stats }),

      setBookings: (bookings) =>
        set({
          bookings: [...bookings],
        }),

      updateBooking: (bookingId, updates) =>
        set((state) => {
          const updatedBookings = state.bookings.map((booking) =>
            booking.id === bookingId ? { ...booking, ...updates } : booking
          );

          return {
            bookings: updatedBookings,
            stats: state.stats
              ? {
                  ...state.stats,
                  totalBookings: updatedBookings.length,
                  confirmedBookings: updatedBookings.filter((b) => b.status === 'confirmed').length,
                  pendingBookings: updatedBookings.filter((b) => b.status === 'pending').length,
                  cancelledBookings: updatedBookings.filter((b) => b.status === 'cancelled').length,
                }
              : state.stats,
          };
        }),

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
