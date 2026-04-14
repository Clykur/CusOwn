'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { BOOKING_STATUS } from '@/config/constants';
import { BookingWithDetails } from '@/types';

export type OwnerDashboardStatusFilter =
  | 'all'
  | (typeof BOOKING_STATUS)[keyof typeof BOOKING_STATUS];

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
  /** Client-side only; empty = all businesses */
  businessIdFilter: string;
  statusFilter: OwnerDashboardStatusFilter;
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
  setBusinessIdFilter: (businessId: string) => void;
  setStatusFilter: (filter: OwnerDashboardStatusFilter) => void;
  setSearchTerm: (term: string) => void;
  setProcessingBookingId: (id: string | null) => void;
  setIsLoading: (loading: boolean) => void;
  setIsRefreshing: (refreshing: boolean) => void;
  setLastFetchedAt: (timestamp: number) => void;
  clearFilters: () => void;
  reset: () => void;
}

const CACHE_TTL_MS = 30_000;

const initialState: Pick<
  OwnerDashboardState,
  | 'stats'
  | 'bookings'
  | 'fromDate'
  | 'toDate'
  | 'businessIdFilter'
  | 'statusFilter'
  | 'searchTerm'
  | 'processingBookingId'
  | 'isLoading'
  | 'isRefreshing'
  | 'lastFetchedAt'
> = {
  stats: null,
  bookings: [],
  fromDate: '',
  toDate: '',
  businessIdFilter: '',
  statusFilter: 'all',
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

      setBusinessIdFilter: (businessIdFilter) => set({ businessIdFilter }),

      setStatusFilter: (statusFilter) => set({ statusFilter }),

      setSearchTerm: (searchTerm) => set({ searchTerm }),

      setProcessingBookingId: (processingBookingId) => set({ processingBookingId }),

      setIsLoading: (isLoading) => set({ isLoading }),

      setIsRefreshing: (isRefreshing) => set({ isRefreshing }),

      setLastFetchedAt: (lastFetchedAt) => set({ lastFetchedAt }),

      clearFilters: () =>
        set({
          fromDate: '',
          toDate: '',
          businessIdFilter: '',
          statusFilter: 'all',
          searchTerm: '',
        }),

      reset: () => set(initialState),
    }),
    {
      /** v2: do not persist date filters (they hid bookings via API + localStorage). */
      name: 'owner-dashboard-store-v2',
      partialize: () => ({}),
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
