'use client';

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AnalyticsOverview {
  totalBookings: number;
  confirmedBookings: number;
  rejectedBookings: number;
  cancelledBookings: number;
  noShowCount: number;
  conversionRate: number;
  cancellationRate: number;
  noShowRate: number;
  peakHour?: string | null;
  totalRevenueCents?: number;
  averageTicketCents?: number;
  failedBookings?: number;
  systemErrors?: number;
  upcoming?: number;
  services?: {
    id: string;
    name: string;
    count: number;
    revenueCents?: number;
  }[];
}

interface DailyPoint {
  date: string;
  totalBookings: number;
  confirmedBookings: number;
  rejectedBookings: number;
  cancelledBookings: number;
  noShowCount: number;
  revenue?: number;
}

interface PeakHourPoint {
  hour: number;
  bookingCount: number;
}

interface AdvancedAnalytics {
  peakHoursHeatmap: PeakHourPoint[];
  repeatCustomerPercentage: number;
  cancellationRate: number;
  revenueTrend: { date: string; revenueCents: number }[];
  servicePopularityRanking: {
    serviceId: string;
    serviceName: string;
    bookingCount: number;
  }[];
}

interface AnalyticsState {
  selectedBusinessId: string;
  startDate: string;
  endDate: string;

  overview: AnalyticsOverview | null;
  dailyData: DailyPoint[];
  peakHours: PeakHourPoint[];
  advancedAnalytics: AdvancedAnalytics | null;

  isLoading: boolean;
  isRefreshing: boolean;
  isExporting: boolean;
  lastUpdatedAt: Date | null;

  setSelectedBusinessId: (id: string) => void;
  setStartDate: (date: string) => void;
  setEndDate: (date: string) => void;
  setDateRange: (start: string, end: string) => void;

  setOverview: (overview: AnalyticsOverview | null) => void;
  setDailyData: (data: DailyPoint[]) => void;
  setPeakHours: (data: PeakHourPoint[]) => void;
  setAdvancedAnalytics: (data: AdvancedAnalytics | null) => void;

  setIsLoading: (loading: boolean) => void;
  setIsRefreshing: (refreshing: boolean) => void;
  setIsExporting: (exporting: boolean) => void;
  setLastUpdatedAt: (date: Date | null) => void;

  setAllData: (data: {
    overview: AnalyticsOverview | null;
    dailyData: DailyPoint[];
    peakHours: PeakHourPoint[];
    advancedAnalytics: AdvancedAnalytics | null;
  }) => void;

  reset: () => void;
}

const getDefaultDates = () => {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 29);
  return {
    startDate: start.toISOString().split('T')[0],
    endDate: end.toISOString().split('T')[0],
  };
};

const { startDate: defaultStart, endDate: defaultEnd } = getDefaultDates();

const initialState = {
  selectedBusinessId: '',
  startDate: defaultStart,
  endDate: defaultEnd,
  overview: null,
  dailyData: [],
  peakHours: [],
  advancedAnalytics: null,
  isLoading: true,
  isRefreshing: false,
  isExporting: false,
  lastUpdatedAt: null,
};

export const useAnalyticsStore = create<AnalyticsState>()(
  persist(
    (set) => ({
      ...initialState,

      setSelectedBusinessId: (selectedBusinessId) => set({ selectedBusinessId }),

      setStartDate: (startDate) => set({ startDate }),

      setEndDate: (endDate) => set({ endDate }),

      setDateRange: (startDate, endDate) => set({ startDate, endDate }),

      setOverview: (overview) => set({ overview }),

      setDailyData: (dailyData) => set({ dailyData }),

      setPeakHours: (peakHours) => set({ peakHours }),

      setAdvancedAnalytics: (advancedAnalytics) => set({ advancedAnalytics }),

      setIsLoading: (isLoading) => set({ isLoading }),

      setIsRefreshing: (isRefreshing) => set({ isRefreshing }),

      setIsExporting: (isExporting) => set({ isExporting }),

      setLastUpdatedAt: (lastUpdatedAt) => set({ lastUpdatedAt }),

      setAllData: ({ overview, dailyData, peakHours, advancedAnalytics }) =>
        set({
          overview,
          dailyData,
          peakHours,
          advancedAnalytics,
          lastUpdatedAt: new Date(),
        }),

      reset: () => {
        const dates = getDefaultDates();
        set({ ...initialState, ...dates });
      },
    }),
    {
      name: 'analytics-store',
      partialize: (state) => ({
        selectedBusinessId: state.selectedBusinessId,
        startDate: state.startDate,
        endDate: state.endDate,
      }),
    }
  )
);

export const selectDaysSelected = (state: AnalyticsState): number => {
  const from = new Date(state.startDate);
  const to = new Date(state.endDate);
  return Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86400000) + 1);
};

export const selectHasNoActivity = (state: AnalyticsState): boolean => {
  return (
    !state.isLoading &&
    state.dailyData.length > 0 &&
    state.dailyData.every((d) => d.totalBookings === 0)
  );
};

export type { AnalyticsOverview, DailyPoint, PeakHourPoint, AdvancedAnalytics, AnalyticsState };
