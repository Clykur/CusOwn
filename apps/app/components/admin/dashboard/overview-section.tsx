'use client';

import { memo, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { AdminMetricCard } from '@/components/admin/admin-metric-card';
import { AdminSectionWrapper } from '@/components/admin/admin-section-wrapper';

const LazyLine = dynamic(
  () => import('@/components/admin/lazy-charts').then((m) => ({ default: m.Line })),
  { ssr: false }
);
const LazyBar = dynamic(
  () => import('@/components/admin/lazy-charts').then((m) => ({ default: m.Bar })),
  { ssr: false }
);

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

interface RevenueSnapshot {
  totalRevenue: number;
  revenueToday: number;
  revenueWeek: number;
  revenueMonth: number;
  paymentSuccessRate: number;
  failedPayments: number;
}

interface OverviewExtras {
  failedBookingsLast24h: number;
  cronRunsLast24h: number;
  systemHealth: {
    status: string;
    cronExpireBookingsOk: boolean;
    cronExpireBookingsLastRun: string | null;
  };
}

interface OverviewSectionProps {
  metrics: PlatformMetrics;
  trends: BookingTrend[];
  revenueSnapshot: RevenueSnapshot | null;
  overviewExtras: OverviewExtras | null;
}

function OverviewSectionComponent({
  metrics,
  trends,
  revenueSnapshot,
  overviewExtras,
}: OverviewSectionProps) {
  const bookingTrendsChart = useMemo(
    () => ({
      labels: trends.map((t) => {
        const date = new Date(t.date);
        return `${date.getMonth() + 1}/${date.getDate()}`;
      }),
      datasets: [
        {
          label: 'Total Bookings',
          data: trends.map((t) => t.total),
          backgroundColor: 'rgb(0, 0, 0)',
          borderColor: 'rgb(0, 0, 0)',
          borderWidth: 2,
        },
        {
          label: 'Confirmed',
          data: trends.map((t) => t.confirmed),
          backgroundColor: 'rgb(64, 64, 64)',
          borderColor: 'rgb(64, 64, 64)',
          borderWidth: 2,
        },
        {
          label: 'Rejected',
          data: trends.map((t) => t.rejected),
          backgroundColor: 'rgb(128, 128, 128)',
          borderColor: 'rgb(128, 128, 128)',
          borderWidth: 2,
        },
      ],
    }),
    [trends]
  );

  const bookingStatusChart = useMemo(
    () => ({
      labels: ['Confirmed', 'Pending', 'Rejected', 'Cancelled'],
      datasets: [
        {
          label: 'Number of Bookings',
          data: [
            metrics.confirmedBookings,
            metrics.pendingBookings,
            metrics.rejectedBookings,
            metrics.cancelledBookings,
          ],
          backgroundColor: [
            'rgb(0, 0, 0)',
            'rgb(64, 64, 64)',
            'rgb(128, 128, 128)',
            'rgb(192, 192, 192)',
          ],
          borderColor: 'rgb(0, 0, 0)',
          borderWidth: 2,
        },
      ],
    }),
    [metrics]
  );

  const growthChart = useMemo(
    () => ({
      labels: ['Businesses', 'Bookings', 'Owners'],
      datasets: [
        {
          label: 'Growth Rate (%)',
          data: [
            metrics.growthRate.businesses,
            metrics.growthRate.bookings,
            metrics.growthRate.owners,
          ],
          borderColor: 'rgb(0, 0, 0)',
          backgroundColor: 'rgba(0, 0, 0, 0.1)',
          borderWidth: 3,
          tension: 0.4,
          fill: true,
          pointRadius: 8,
          pointBackgroundColor: ['rgb(0, 0, 0)', 'rgb(64, 64, 64)', 'rgb(128, 128, 128)'],
          pointBorderColor: 'rgb(0, 0, 0)',
          pointBorderWidth: 2,
        },
      ],
    }),
    [metrics]
  );

  const getGrowthVariant = (value: number) => {
    if (value > 0) return 'positive';
    if (value < 0) return 'negative';
    return 'neutral';
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-xl font-semibold text-slate-900 tracking-tight">Overview</h1>
        <p className="mt-0.5 text-sm text-slate-500">Platform-wide metrics at a glance</p>
      </div>

      <AdminSectionWrapper title="Core metrics" subtitle="Businesses, bookings and owners">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminMetricCard
            label="Total businesses"
            value={metrics.totalBusinesses}
            secondary={`${metrics.growthRate.businesses > 0 ? '+' : ''}${metrics.growthRate.businesses.toFixed(1)}% growth`}
            secondaryVariant={getGrowthVariant(metrics.growthRate.businesses)}
          />
          <AdminMetricCard
            label="Active businesses"
            value={metrics.activeBusinesses}
            secondary={`${metrics.suspendedBusinesses} suspended`}
          />
          <AdminMetricCard
            label="Total bookings"
            value={metrics.totalBookings}
            secondary={`${metrics.growthRate.bookings > 0 ? '+' : ''}${metrics.growthRate.bookings.toFixed(1)}% growth`}
            secondaryVariant={getGrowthVariant(metrics.growthRate.bookings)}
          />
          <AdminMetricCard
            label="Total owners"
            value={metrics.totalOwners}
            secondary={`${metrics.growthRate.owners > 0 ? '+' : ''}${metrics.growthRate.owners.toFixed(1)}% growth`}
            secondaryVariant={getGrowthVariant(metrics.growthRate.owners)}
          />
        </div>
      </AdminSectionWrapper>

      <AdminSectionWrapper
        title="Booking volume"
        subtitle="Today, this week, this month and customers"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminMetricCard label="Bookings today" value={metrics.bookingsToday} />
          <AdminMetricCard label="This week" value={metrics.bookingsThisWeek} />
          <AdminMetricCard label="This month" value={metrics.bookingsThisMonth} />
          <AdminMetricCard label="Total customers" value={metrics.totalCustomers} />
        </div>
      </AdminSectionWrapper>

      {overviewExtras && (
        <AdminSectionWrapper
          title="System (last 24h)"
          subtitle="Failed bookings, cron runs, health"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AdminMetricCard
              label="Failed bookings (24h)"
              value={overviewExtras.failedBookingsLast24h}
            />
            <AdminMetricCard label="Cron runs (24h)" value={overviewExtras.cronRunsLast24h} />
            <AdminMetricCard label="System health" value={overviewExtras.systemHealth.status} />
            <AdminMetricCard
              label="Cron expire OK"
              value={overviewExtras.systemHealth.cronExpireBookingsOk ? 'Yes' : 'No'}
            />
          </div>
          {overviewExtras.systemHealth.cronExpireBookingsLastRun && (
            <p className="mt-2 text-xs text-slate-500">
              Last cron run:{' '}
              {new Date(overviewExtras.systemHealth.cronExpireBookingsLastRun).toLocaleString()}
            </p>
          )}
        </AdminSectionWrapper>
      )}

      {revenueSnapshot && (
        <AdminSectionWrapper title="Revenue (last 30 days)" subtitle="Totals and payment success">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
            <AdminMetricCard
              label="Total revenue"
              value={`₹${revenueSnapshot.totalRevenue.toFixed(2)}`}
            />
            <AdminMetricCard label="Today" value={`₹${revenueSnapshot.revenueToday.toFixed(2)}`} />
            <AdminMetricCard
              label="This week"
              value={`₹${revenueSnapshot.revenueWeek.toFixed(2)}`}
            />
            <AdminMetricCard
              label="This month"
              value={`₹${revenueSnapshot.revenueMonth.toFixed(2)}`}
            />
            <AdminMetricCard
              label="Payment success %"
              value={`${revenueSnapshot.paymentSuccessRate.toFixed(2)}%`}
            />
            <AdminMetricCard label="Failed payments" value={revenueSnapshot.failedPayments} />
          </div>
        </AdminSectionWrapper>
      )}

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <AdminSectionWrapper
          title="Booking trends (30 days)"
          subtitle="Daily totals and status breakdown"
        >
          {trends.length > 0 ? (
            <LazyBar
              data={bookingTrendsChart}
              options={{
                responsive: true,
                plugins: {
                  legend: { position: 'top' as const },
                  title: { display: false },
                },
                scales: { y: { beginAtZero: true } },
              }}
            />
          ) : (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 py-12 text-center">
              <p className="text-sm font-medium text-slate-500">No data available</p>
            </div>
          )}
        </AdminSectionWrapper>

        <AdminSectionWrapper
          title="Booking status distribution"
          subtitle="Confirmed, pending, rejected, cancelled"
        >
          <LazyBar
            data={bookingStatusChart}
            options={{
              responsive: true,
              plugins: { legend: { position: 'top' as const } },
              scales: { y: { beginAtZero: true } },
            }}
          />
        </AdminSectionWrapper>
      </div>

      <AdminSectionWrapper title="Growth trends" subtitle="Growth rate by category">
        <LazyLine
          data={growthChart}
          options={{
            responsive: true,
            plugins: {
              legend: { position: 'top' as const },
              title: { display: false },
            },
            scales: { y: { beginAtZero: true } },
          }}
        />
      </AdminSectionWrapper>
    </div>
  );
}

export const OverviewSection = memo(OverviewSectionComponent);
