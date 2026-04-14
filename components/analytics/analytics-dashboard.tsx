'use client';

import { Suspense, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { getServerSessionClient } from '@/lib/auth/server-session-client';
import AnalyticsHeader from '@/components/analytics/AnalyticsHeader';
import AnalyticsFilters, { AnalyticsMobileToolbar } from '@/components/analytics/AnalyticsFilters';
import { OWNER_SCREEN_TITLE_CLASSNAME, UI_CONTEXT } from '@/config/constants';
import { cn } from '@/lib/utils/cn';
import KPISection from '@/components/analytics/KPISection';
import OperationalHealthPanel from '@/components/analytics/OperationalHealthPanel';
import AnalyticsSkeleton from '@/components/analytics/AnalyticsSkeleton';

/** Lazy chart/table slot — same classes as previous inline fallbacks. */
function AnalyticsPanelSkeleton({ height }: { height: 'h-72' | 'h-80' }) {
  return (
    <div
      className={`${height} animate-pulse rounded-xl border border-gray-200 bg-gray-100`}
      aria-hidden
    />
  );
}

function AnalyticsSectionHeading({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      className="px-0.5 text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500"
    >
      {children}
    </h2>
  );
}

const BookingTrendChart = dynamic(() => import('@/components/analytics/BookingTrendChart'), {
  ssr: false,
  loading: () => <AnalyticsPanelSkeleton height="h-80" />,
});
const RevenueTrendChart = dynamic(() => import('@/components/analytics/RevenueTrendChart'), {
  ssr: false,
  loading: () => <AnalyticsPanelSkeleton height="h-80" />,
});
const StatusBreakdownChart = dynamic(() => import('@/components/analytics/StatusBreakdownChart'), {
  ssr: false,
  loading: () => <AnalyticsPanelSkeleton height="h-80" />,
});
const PeakHoursHeatmap = dynamic(() => import('@/components/analytics/PeakHoursHeatmap'), {
  ssr: false,
  loading: () => <AnalyticsPanelSkeleton height="h-72" />,
});
const ServicePerformanceTable = dynamic(
  () => import('@/components/analytics/ServicePerformanceTable'),
  {
    ssr: false,
    loading: () => <AnalyticsPanelSkeleton height="h-72" />,
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

export interface AdvancedAnalytics {
  peakHoursHeatmap: { hour: number; bookingCount: number }[];
  repeatCustomerPercentage: number;
  cancellationRate: number;
  revenueTrend: { date: string; revenueCents: number }[];
  servicePopularityRanking: {
    serviceId: string;
    serviceName: string;
    bookingCount: number;
  }[];
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
  const [analytics, setAnalytics] = useState<AnalyticsOverview | null>(null);
  const [dailyData, setDailyData] = useState<DailyPoint[]>([]);
  const [peakHours, setPeakHours] = useState<PeakHourPoint[]>([]);
  const [retention, setRetention] = useState<RetentionPoint[] | null>(null);
  const [advancedAnalytics, setAdvancedAnalytics] = useState<AdvancedAnalytics | null>(null);

  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [exporting, setExporting] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [filtersActiveHighlight, setFiltersActiveHighlight] = useState(false);

  const cacheKey = `${selectedBusinessId}:${startDate}:${endDate}`;

  const fetchAnalytics = useCallback(async () => {
    if (!selectedBusinessId) return;
    setLoading(true);

    let hasCached = false;
    try {
      const cached = sessionStorage.getItem(`analytics:${cacheKey}`);
      if (cached) {
        const parsed = JSON.parse(cached);
        setAnalytics(parsed.analytics ?? null);
        setDailyData(parsed.dailyData ?? []);
        setPeakHours(parsed.peakHours ?? []);
        setRetention(parsed.retention ?? []);
        setAdvancedAnalytics(parsed.advancedAnalytics ?? null);
        setLastUpdatedAt(parsed.lastUpdatedAt ? new Date(parsed.lastUpdatedAt) : null);
        hasCached = true;
        setLoading(false);
      }
    } catch {
      // ignore cache parse errors
    }

    try {
      const { user } = await getServerSessionClient();
      if (!user) throw new Error('Authentication required');

      const response = await fetch(
        `/api/owner/analytics?business_id=${selectedBusinessId}&aggregated=true&start_date=${startDate}&end_date=${endDate}`,
        { credentials: 'include' }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch analytics');
      }

      const json = await response.json();
      if (!json?.success || !json?.data) {
        throw new Error('Invalid analytics response');
      }

      const data = json.data as {
        overview?: AnalyticsOverview | null;
        daily?: DailyPoint[];
        peakHours?: PeakHourPoint[];
        retention?: RetentionPoint[];
        advanced?: AdvancedAnalytics | null;
      };

      const next: {
        analytics: AnalyticsOverview | null;
        dailyData: DailyPoint[];
        peakHours: PeakHourPoint[];
        retention: RetentionPoint[];
        advancedAnalytics: AdvancedAnalytics | null;
      } = {
        analytics: data.overview ?? null,
        dailyData: data.daily ?? [],
        peakHours: data.peakHours ?? [],
        retention: data.retention ?? [],
        advancedAnalytics: null,
      };

      if (data.advanced) {
        next.advancedAnalytics = {
          peakHoursHeatmap: data.advanced.peakHoursHeatmap ?? [],
          repeatCustomerPercentage: data.advanced.repeatCustomerPercentage ?? 0,
          cancellationRate: data.advanced.cancellationRate ?? 0,
          revenueTrend: data.advanced.revenueTrend ?? [],
          servicePopularityRanking: data.advanced.servicePopularityRanking ?? [],
        };
        if (next.advancedAnalytics.peakHoursHeatmap.length > 0) {
          next.peakHours = next.advancedAnalytics.peakHoursHeatmap;
        }
      }

      setAnalytics(next.analytics);
      setDailyData(next.dailyData);
      setPeakHours(next.peakHours);
      setRetention(next.retention);
      setAdvancedAnalytics(next.advancedAnalytics);
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
        setAdvancedAnalytics(null);
      }
    } finally {
      setLoading(false);
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
      <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-10 text-center">
        <p className="text-sm font-medium text-slate-700">No business selected</p>
      </div>
    );
  }

  if (loading && !analytics && dailyData.length === 0 && peakHours.length === 0) {
    return <AnalyticsSkeleton />;
  }

  return (
    <div className="w-full space-y-5 bg-slate-50/60 px-0 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:space-y-6 sm:px-1 md:space-y-7 md:pb-16">
      <div className="mb-6 md:mb-8 px-0 sm:px-1">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h1 className={cn(OWNER_SCREEN_TITLE_CLASSNAME, 'mb-1 md:mb-2')}>
              {UI_CONTEXT.OWNER_ANALYTICS_PAGE_TITLE}
            </h1>
            <p className="hidden text-sm leading-snug text-gray-600 md:block md:text-base">
              {UI_CONTEXT.OWNER_ANALYTICS_PAGE_SUBTITLE}
            </p>
          </div>
          <div className="shrink-0 pt-0.5 md:hidden">
            <AnalyticsMobileToolbar
              onExport={handleExport}
              exporting={exporting}
              onOpenFilters={() => setFilterSheetOpen(true)}
              hasActiveFilters={filtersActiveHighlight}
            />
          </div>
        </div>
        <p className="mt-2 text-sm leading-snug text-gray-600 md:hidden">
          {UI_CONTEXT.OWNER_ANALYTICS_PAGE_SUBTITLE}
        </p>
      </div>

      <AnalyticsHeader>
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
          filterSheetOpen={filterSheetOpen}
          onFilterSheetOpenChange={setFilterSheetOpen}
          onHasActiveFiltersChange={setFiltersActiveHighlight}
        />
      </AnalyticsHeader>

      {hasNoActivity ? (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-gray-200 bg-white p-10 text-center shadow-sm"
        >
          <p className="text-base font-semibold text-slate-900">
            No booking activity in selected period
          </p>
          <p className="mt-2 text-sm text-slate-500">
            Try widening the date range, sharing your booking link, or running a promotion.
          </p>
          <div className="mt-4 inline-flex gap-2">
            <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-slate-700">
              Create promotion
            </span>
            <span className="rounded-md border border-gray-200 bg-gray-50 px-3 py-1.5 text-sm text-slate-700">
              Share booking link
            </span>
          </div>
        </motion.div>
      ) : (
        <div className="space-y-6 md:space-y-8">
          <section className="space-y-3" aria-labelledby="analytics-section-kpis">
            <AnalyticsSectionHeading id="analytics-section-kpis">
              {UI_CONTEXT.OWNER_ANALYTICS_SECTION_KPIS}
            </AnalyticsSectionHeading>
            <KPISection analytics={analytics} advanced={advancedAnalytics} />
          </section>

          <section className="space-y-3" aria-labelledby="analytics-section-trends">
            <AnalyticsSectionHeading id="analytics-section-trends">
              {UI_CONTEXT.OWNER_ANALYTICS_SECTION_TRENDS}
            </AnalyticsSectionHeading>
            <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
              <Suspense fallback={<AnalyticsPanelSkeleton height="h-80" />}>
                <BookingTrendChart dailyData={dailyData} />
              </Suspense>
              <Suspense fallback={<AnalyticsPanelSkeleton height="h-80" />}>
                <RevenueTrendChart dailyData={dailyData} />
              </Suspense>
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="analytics-section-status">
            <AnalyticsSectionHeading id="analytics-section-status">
              {UI_CONTEXT.OWNER_ANALYTICS_SECTION_STATUS_PEAK}
            </AnalyticsSectionHeading>
            <div className="grid grid-cols-1 gap-4 md:gap-6 xl:grid-cols-2">
              <Suspense fallback={<AnalyticsPanelSkeleton height="h-80" />}>
                <StatusBreakdownChart analytics={analytics} />
              </Suspense>
              <Suspense fallback={<AnalyticsPanelSkeleton height="h-72" />}>
                <PeakHoursHeatmap peakHours={peakHours} />
              </Suspense>
            </div>
          </section>

          <section aria-label={UI_CONTEXT.OWNER_ANALYTICS_SECTION_SERVICES}>
            <Suspense fallback={<AnalyticsPanelSkeleton height="h-72" />}>
              <ServicePerformanceTable
                services={
                  advancedAnalytics?.servicePopularityRanking?.length
                    ? advancedAnalytics.servicePopularityRanking.map((s) => ({
                        id: s.serviceId,
                        name: s.serviceName,
                        count: s.bookingCount,
                        revenueCents: 0,
                      }))
                    : (analytics?.services ?? [])
                }
              />
            </Suspense>
          </section>

          <section aria-label={UI_CONTEXT.OWNER_ANALYTICS_SECTION_OPERATIONS}>
            <OperationalHealthPanel
              insights={{
                failedBookings: analytics?.failedBookings ?? 0,
                cronHealthy: true,
                systemErrors: analytics?.systemErrors ?? 0,
                upcoming: analytics?.upcoming ?? 0,
                repeatCustomers: retention
                  ? retention.filter((r) => r.totalBookings > 1).length
                  : 0,
                customerGrowth: null,
              }}
              lastUpdatedAt={lastUpdatedAt}
            />
          </section>
        </div>
      )}
    </div>
  );
}
