import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface PlatformMetrics {
  totalBusinesses: number;
  activeBusinesses: number;
  suspendedBusinesses: number;
  totalOwners: number;
  totalCustomers: number;
  totalBookings: number;
  confirmedBookings: number;
  rejectedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
  bookingsToday: number;
  bookingsThisWeek: number;
  bookingsThisMonth: number;
  growthRate: {
    businesses: number;
    bookings: number;
    owners: number;
  };
}

interface BookingTrend {
  date: string;
  total: number;
  confirmed: number;
  rejected: number;
}

interface OverviewExtras {
  failedBookingsLast24h: number;
  cronRunsLast24h: number;
  cronSuccessLast24h: number;
  cronFailedLast24h: number;
  systemHealthy: boolean;
}

interface RevenueSnapshot {
  totalRevenue: number;
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  avgBookingValue: number;
  paymentSuccessRate: number;
  failedPayments: number;
}

interface AdminDashboardState {
  metrics: PlatformMetrics | null;
  trends: BookingTrend[];
  overviewExtras: OverviewExtras | null;
  revenueSnapshot: RevenueSnapshot | null;
  lastFetchedAt: number | null;
  isStale: boolean;

  setMetrics: (metrics: PlatformMetrics | null) => void;
  setTrends: (trends: BookingTrend[]) => void;
  setOverviewExtras: (extras: OverviewExtras | null) => void;
  setRevenueSnapshot: (snapshot: RevenueSnapshot | null) => void;
  setLastFetchedAt: (timestamp: number) => void;
  markStale: () => void;
  clearAll: () => void;
  hasValidCache: () => boolean;
}

const CACHE_TTL_MS = 30_000;

export const useAdminDashboardStore = create<AdminDashboardState>()(
  persist(
    (set, get) => ({
      metrics: null,
      trends: [],
      overviewExtras: null,
      revenueSnapshot: null,
      lastFetchedAt: null,
      isStale: true,

      setMetrics: (metrics) => set({ metrics, isStale: false }),
      setTrends: (trends) => set({ trends }),
      setOverviewExtras: (overviewExtras) => set({ overviewExtras }),
      setRevenueSnapshot: (revenueSnapshot) => set({ revenueSnapshot }),
      setLastFetchedAt: (timestamp) => set({ lastFetchedAt: timestamp, isStale: false }),
      markStale: () => set({ isStale: true }),
      clearAll: () =>
        set({
          metrics: null,
          trends: [],
          overviewExtras: null,
          revenueSnapshot: null,
          lastFetchedAt: null,
          isStale: true,
        }),

      hasValidCache: () => {
        const state = get();
        if (!state.metrics || !state.lastFetchedAt) return false;
        const elapsed = Date.now() - state.lastFetchedAt;
        return elapsed < CACHE_TTL_MS && !state.isStale;
      },
    }),
    {
      name: 'admin-dashboard-store',
      partialize: (state) => ({
        metrics: state.metrics,
        trends: state.trends,
        overviewExtras: state.overviewExtras,
        revenueSnapshot: state.revenueSnapshot,
        lastFetchedAt: state.lastFetchedAt,
      }),
    }
  )
);

export type { PlatformMetrics, BookingTrend, OverviewExtras, RevenueSnapshot };
