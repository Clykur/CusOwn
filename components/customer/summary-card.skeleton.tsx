'use client';

import { Skeleton } from '@/components/ui/skeleton';

export default function SummaryCardSkeleton() {
  return (
    <div
      className="bg-white rounded-xl shadow-md p-6 border border-gray-200"
      aria-busy="true"
      aria-hidden="true"
    >
      <div className="flex items-center gap-3">
        <Skeleton className="rounded-lg p-3 w-12 h-12" />
        <div className="flex-1">
          <Skeleton className="h-6 w-12 mb-2" />
          <Skeleton className="h-4 w-20" />
        </div>
      </div>
    </div>
  );
}
