'use client';

import { Skeleton } from '@/components/ui/skeleton';

export default function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-hidden="true">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="mt-2 h-4 w-80" />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
          <Skeleton className="h-10 rounded-lg" />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, idx) => (
          <Skeleton key={idx} className="h-40 rounded-xl" />
        ))}
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
      <Skeleton className="h-72 rounded-xl" />
      <Skeleton className="h-72 rounded-xl" />
    </div>
  );
}
