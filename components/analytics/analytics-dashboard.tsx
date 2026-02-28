'use client';

import { Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { getServerSessionClient } from '@/lib/auth/server-session-client';
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader';
import AnalyticsFilters from '@/components/analytics/AnalyticsFilters';
import KPISection from '@/components/analytics/KPISection';
import OperationalHealthPanel from '@/components/analytics/OperationalHealthPanel';
import AnalyticsSkeleton from '@/components/analytics/AnalyticsSkeleton';

const BookingTrendChart = dynamic(() => import('@/components/analytics/BookingTrendChart'), {
  ssr: false,
  loading: () => (
    <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
  ),
});
const RevenueTrendChart = dynamic(() => import('@/components/analytics/RevenueTrendChart'), {
  ssr: false,
  loading: () => (
    <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
  ),
});
const StatusBreakdownChart = dynamic(() => import('@/components/analytics/StatusBreakdownChart'), {
  ssr: false,
  loading: () => (
    <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
  ),
});
const PeakHoursHeatmap = dynamic(() => import('@/components/analytics/PeakHoursHeatmap'), {
  ssr: false,
  loading: () => (
    <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
  ),
});
const ServicePerformanceTable = dynamic(
  () => import('@/components/analytics/ServicePerformanceTable'),
  {
    ssr: false,
    loading: () => (
      <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
    ),
  }
);

export interface OwnerBusiness {
  id: string;
  salon_name: string;
}

export interface AnalyticsOverview {
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

export interface DailyPoint {
  date: string;
  totalBookings: number;
  confirmedBookings: number;
  rejectedBookings: number;
  cancelledBookings: number;
  noShowCount: number;
  revenue?: number;
}

export interface PeakHourPoint {
  hour: number;
  bookingCount: number;
}

export interface RetentionPoint {
  totalBookings: number;
}

export default function AnalyticsDashboard({
  businesses,
  selectedBusinessId,
  onBusinessChange,
}: {
  businesses: OwnerBusiness[];
  selectedBusinessId: string;
  onBusinessChange: (value: string) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [dailyData, setDailyData] = useState<DailyPoint[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHourPoint[]>([]);
  const [retention, setRetention] = useState<RetentionPoint[] | null>(null);

  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [exporting, setExporting] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const cacheKey = `${selectedBusinessId}:${startDate}:${endDate}`;

  const fetchAnalytics = useCallback(async () => {
    if (!selectedBusinessId) return;
    setLoading(true);

    // stale-while-revalidate
    let hasCached = false;
    try {
      const cached = sessionStorage.getItem(`analytics:${cacheKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setAnalytics(parsed.analytics ?? null);
        setDailyData(parsed.dailyData ?? []);
        setPeakHours(parsed.peakHours ?? []);
        setRetention(parsed.retention ?? []);
        setLastUpdatedAt(parsed.lastUpdatedAt ? new Date(parsed.lastUpdatedAt) : null);
        hasCached = true;
        setLoading(false);
        setRefreshing(true);
      }
    } catch {
      // ignore cache parse errors
    }

    try {
      const { user } = await getServerSessionClient();
      if (!user) throw new Error('Authentication required');

      const [overviewRes, dailyRes, peakRes, retentionRes] = await Promise.all([
        fetch(
          `/api/owner/analytics?business_id=${selectedBusinessId}&type=overview&start_date=${startDate}&end_date=${endDate}`,
          { credentials: 'include' }
        ),
        fetch(
          `/api/owner/analytics?business_id=${selectedBusinessId}&type=daily&start_date=${startDate}&end_date=${endDate}`,
          { credentials: 'include' }
        ),
        fetch(
          `/api/owner/analytics?business_id=${selectedBusinessId}&type=peak-hours&start_date=${startDate}&end_date=${endDate}`,
          { credentials: 'include' }
        ),
        fetch(`/api/owner/analytics?business_id=${selectedBusinessId}&type=retention`, {
          credentials: 'include',
        }),
      ]);

      const next: {
        analytics: AnalyticsOverview | null;
        dailyData: DailyPoint[];
        peakHours: PeakHourPoint[];
        retention: RetentionPoint[];
      } = {
        analytics: null,
        dailyData: [],
        peakHours: [],
        retention: [],
      };

      if (overviewRes.ok) {
        const json = await overviewRes.json();
        if (json?.success) next.analytics = json.data;
      }
      if (dailyRes.ok) {
        const json = await dailyRes.json();
        if (json?.success) next.dailyData = json.data;
      }
      if (peakRes.ok) {
        const json = await peakRes.json();
        if (json?.success) next.peakHours = json.data;
      }
      if (retentionRes.ok) {
        const json = await retentionRes.json();
        if (json?.success) next.retention = json.data;
      }

      setAnalytics(next.analytics);
      setDailyData(next.dailyData);
      setPeakHours(next.peakHours);
      setRetention(next.retention);
      const stamp = new Date();
      setLastUpdatedAt(stamp);

      try {
        sessionStorage.setItem(
          `analytics:${cacheKey}`,
          JSON.stringify({
            ...next,
            lastUpdatedAt: stamp.toISOString(),
          })
        );
      } catch {
        // ignore cache write errors
      }
    } catch (error) {
      console.error('Failed to fetch owner analytics:', error);
      if (!hasCached) {
        setAnalytics(null);
        setDailyData([]);
        setPeakHours([]);
        setRetention([]);
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [cacheKey, endDate, selectedBusinessId, startDate]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const handleExport = useCallback(async () => {
    if (!selectedBusinessId) return;
    setExporting(true);
    try {
      const response = await fetch(
        `/api/owner/analytics/export?business_id=${selectedBusinessId}&start_date=${startDate}&end_date=${endDate}`,
        { credentials: 'include' }
      );
      if (!response.ok) return;
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `analytics-${selectedBusinessId}-${startDate}-${endDate}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error('Failed to export analytics:', error);
    } finally {
      setExporting(false);
    }
  }, [endDate, selectedBusinessId, startDate]);

  const daysSelected = useMemo(() => {
    const from = new Date(startDate);
    const to = new Date(endDate);
    const diff = Math.max(1, Math.floor((to.getTime() - from.getTime()) / 86400000) + 1);
    return diff;
  }, [endDate, startDate]);

  const hasNoActivity = useMemo(() => {
    return !loading && dailyData.length > 0 && dailyData.every((d) => d.totalBookings === 0);
  }, [dailyData, loading]);

  if (!selectedBusinessId) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">No business selected</p>
      </div>
    );
  }

  if (loading && !analytics && dailyData.length === 0 && peakHours.length === 0) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="w-full space-y-6 bg-slate-50/60 px-1 pb-16">
      <AnalyticsHeader refreshing={refreshing}>
        <AnalyticsFilters
          businesses={businesses}
          selectedBusinessId={selectedBusinessId}
          onBusinessChange={onBusinessChange}
          startDate={startDate}
          endDate={endDate}
          setStartDate={setStartDate}
          setEndDate={setEndDate}
          onExport={handleExport}
          exporting={exporting}
        />
      </AnalyticsHeader>

      {hasNoActivity ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm"
        >
          <p className="text-base font-semibold text-slate-900">
            No booking activity in selected period
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Try widening the date range, sharing your booking link, or running a promotion.
          </p>
          <div className="mt-4 inline-flex gap-2">
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
              Create promotion
            </span>
            <span className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm text-slate-700">
              Share booking link
            </span>
          </div>
        </motion.div>
      ) : (
        <>
          <KPISection analytics={analytics} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Suspense
              fallback={
                <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
              }
            >
              <BookingTrendChart dailyData={dailyData} />
            </Suspense>
            <Suspense
              fallback={
                <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
              }
            >
              <RevenueTrendChart dailyData={dailyData} />
            </Suspense>
          </div>

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <Suspense
              fallback={
                <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
              }
            >
              <StatusBreakdownChart analytics={analytics} />
            </Suspense>
            <Suspense
              fallback={
                <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
              }
            >
              <PeakHoursHeatmap peakHours={peakHours} />
            </Suspense>
          </div>

          <Suspense
            fallback={
              <div className="h-72 animate-pulse rounded-xl border border-slate-200 bg-slate-100" />
            }
          >
            <ServicePerformanceTable services={analytics?.services || []} />
          </Suspense>

          <OperationalHealthPanel
            insights={{
              failedBookings: analytics?.failedBookings ?? 0,
              cronHealthy: true,
              systemErrors: analytics?.systemErrors ?? 0,
              upcoming: analytics?.upcoming ?? 0,
              repeatCustomers: retention ? retention.filter((r) => r.totalBookings > 1).length : 0,
              customerGrowth: null,
            }}
            lastUpdatedAt={lastUpdatedAt}
          />
        </>
      )}
    </div>
  );
}
