'use client';

import { Skeleton } from '@/components/ui/skeleton';

export default function AnalyticsDashboardSkeleton() {
  return (
    <div className="w-full space-y-6 lg:max-w-6xl lg:mx-auto" aria-busy="true" aria-hidden="true">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <Skeleton className="h-8 w-32" />
        <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
          <Skeleton className="h-10 w-40 rounded" />
          <Skeleton className="h-10 w-40 rounded" />
          <Skeleton className="h-10 w-24 rounded" />
        </div>
      </div>
      <Skeleton className="h-64 w-full rounded-lg" />
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    </div>
  );
}
