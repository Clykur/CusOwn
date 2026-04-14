'use client';

import SummaryCardSkeleton from '@/components/customer/summary-card.skeleton';

/**
 * Customer dashboard in-page initial load: stat row + appointments section placeholder.
 * Classes mirror the loaded StatsSection + table card (slate pulse, not skeleton-shimmer).
 */
export function CustomerDashboardInitialLoadSkeleton() {
  return (
    <div className="w-full pb-24 flex flex-col gap-8 animate-in fade-in duration-200">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
        <SummaryCardSkeleton />
      </div>
      <div>
        <div className="h-7 w-40 bg-slate-200 rounded mb-4 animate-pulse" aria-hidden />
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
          <div className="animate-pulse space-y-3">
            <div className="h-10 bg-slate-100 rounded w-full" aria-hidden />
            <div className="h-10 bg-slate-100 rounded w-full" aria-hidden />
            <div className="h-10 bg-slate-100 rounded w-full" aria-hidden />
          </div>
        </div>
      </div>
    </div>
  );
}
