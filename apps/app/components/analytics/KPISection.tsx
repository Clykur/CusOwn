'use client';

import { memo, useMemo } from 'react';
import { motion } from 'framer-motion';

function currency(cents?: number): string {
  const value = (cents || 0) / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPeakHour(value: string | null | undefined): string {
  if (!value) return '—';
  const hourPart = value.split(':')[0];
  const hour = Number(hourPart);
  if (!Number.isFinite(hour)) return '—';
  return `${String(hour).padStart(2, '0')}:00`;
}

const KPICompactCard = memo(function KPICompactCard({
  title,
  value,
}: {
  title: string;
  value: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-3 shadow-sm sm:p-3.5">
      <p className="text-[10px] font-semibold uppercase leading-tight tracking-wide text-slate-500 sm:text-[11px]">
        {title}
      </p>
      <p className="mt-1 break-words text-base font-semibold text-slate-900 sm:mt-1.5 sm:text-xl">
        {value}
      </p>
    </div>
  );
});

type AdvancedAnalytics = {
  repeatCustomerPercentage: number;
  cancellationRate: number;
};

function KPISectionComponent({
  analytics,
  advanced,
}: {
  analytics: any;
  advanced?: AdvancedAnalytics | null;
}) {
  const memoizedKpis = useMemo(() => {
    const bookings = analytics?.totalBookings ?? 0;
    return [
      { title: 'Total Revenue', value: currency(analytics?.totalRevenueCents) },
      { title: 'Total Bookings', value: String(bookings) },
      { title: 'Conversion Rate', value: `${analytics?.conversionRate ?? 0}%` },
      {
        title: 'Avg Ticket Size',
        value: currency(analytics?.averageTicketCents),
      },
      { title: 'No Show Rate', value: `${analytics?.noShowRate ?? 0}%` },
      { title: 'Peak Hour', value: formatPeakHour(analytics?.peakHour) },
      ...(advanced
        ? [
            { title: 'Repeat Customer %', value: `${advanced.repeatCustomerPercentage}%` },
            { title: 'Cancellation Rate', value: `${advanced.cancellationRate}%` },
          ]
        : []),
    ];
  }, [
    analytics?.totalRevenueCents,
    analytics?.totalBookings,
    analytics?.conversionRate,
    analytics?.averageTicketCents,
    analytics?.noShowRate,
    analytics?.peakHour,
    advanced,
  ]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="grid grid-cols-2 gap-2 sm:gap-3 md:grid-cols-2 xl:grid-cols-3">
        {memoizedKpis.map((kpi) => (
          <KPICompactCard key={kpi.title} title={kpi.title} value={kpi.value} />
        ))}
      </div>
    </motion.div>
  );
}

const KPISection = memo(KPISectionComponent);
export default KPISection;
