'use client';

import { motion } from 'framer-motion';
import { Card } from '@tremor/react';

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

function KPICompactCard({ title, value }: { title: string; value: string }) {
  return (
    <Card className="rounded-xl border border-slate-200 p-3.5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <p className="mt-1.5 text-xl font-semibold text-slate-900">{value}</p>
    </Card>
  );
}

export default function KPISection({ analytics }: { analytics: any }) {
  const bookings = analytics?.totalBookings ?? 0;
  const compactKpis = [
    { title: 'Total Revenue', value: currency(analytics?.totalRevenueCents) },
    { title: 'Total Bookings', value: String(bookings) },
    { title: 'Conversion Rate', value: `${analytics?.conversionRate ?? 0}%` },
    {
      title: 'Avg Ticket Size',
      value: currency(analytics?.averageTicketCents),
    },
    { title: 'No Show Rate', value: `${analytics?.noShowRate ?? 0}%` },
    { title: 'Peak Hour', value: formatPeakHour(analytics?.peakHour) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {compactKpis.map((kpi) => (
          <KPICompactCard key={kpi.title} title={kpi.title} value={kpi.value} />
        ))}
      </div>
    </motion.div>
  );
}
