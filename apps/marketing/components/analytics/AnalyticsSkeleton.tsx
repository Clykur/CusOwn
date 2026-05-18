'use client';

import { Skeleton } from '@/components/ui/skeleton';

/** In-dashboard loading: mirrors sticky filter strip + KPI grid + chart grid (no outer filter card). */
export default function AnalyticsSkeleton() {
  return (
    <div
      className="w-full space-y-6 bg-slate-50/60 px-0 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] sm:px-1 md:pb-16"
      aria-busy="true"
      aria-hidden="true"
    >
      <div className="sticky top-0 z-20 -mx-0 border-b border-slate-200/80 bg-white/80 pb-3 pt-2 backdrop-blur-md sm:-mx-1 sm:px-1">
        <div className="px-0 sm:px-1">
          <div className="hidden md:block">
            <div className="rounded-xl bg-slate-100/60 p-4">
              <div className="flex flex-col gap-4 xl:flex-row xl:flex-wrap xl:items-end xl:gap-6">
                <Skeleton className="h-11 w-full rounded-lg sm:w-[260px] xl:flex-1" />
                <Skeleton className="h-11 w-full rounded-lg sm:w-[260px] xl:flex-1" />
                <Skeleton className="h-11 w-full rounded-lg sm:w-[260px] xl:flex-1" />
                <Skeleton className="h-11 w-full rounded-lg sm:w-[260px] xl:flex-1" />
                <Skeleton className="h-11 w-11 shrink-0 rounded-xl xl:flex-initial" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 8 }).map((_, idx) => (
          <Skeleton key={idx} className="h-[88px] rounded-xl border border-gray-200/80" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-xl border border-gray-200/80" />
        <Skeleton className="h-80 rounded-xl border border-gray-200/80" />
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-xl border border-gray-200/80" />
        <Skeleton className="h-72 rounded-xl border border-gray-200/80" />
      </div>

      <Skeleton className="h-72 rounded-xl border border-gray-200/80" />
    </div>
  );
}
