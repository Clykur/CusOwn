'use client';

import { Skeleton } from '@/components/ui/skeleton';

export default function BookingCardSkeleton() {
  return (
    <div
      className="bg-white border border-slate-200 rounded-lg overflow-hidden"
      aria-busy="true"
      aria-hidden="true"
    >
      <div className="p-4 sm:p-6">
        <div className="flex items-start justify-between gap-4 mb-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <Skeleton className="rounded-xl p-2.5 w-10 h-10 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <Skeleton className="h-5 sm:h-6 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </div>
          <Skeleton className="rounded-full w-20 h-6 flex-shrink-0" />
        </div>
        <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-100">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Skeleton className="rounded-lg p-2 w-8 h-8" />
              <div className="flex-1">
                <Skeleton className="h-3 w-12 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Skeleton className="rounded-lg p-2 w-8 h-8" />
              <div className="flex-1">
                <Skeleton className="h-3 w-12 mb-2" />
                <Skeleton className="h-4 w-20" />
              </div>
            </div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-3">
          <Skeleton className="flex-1 sm:flex-initial h-10 rounded-xl" />
          <Skeleton className="flex-1 sm:flex-initial h-10 rounded-xl" />
        </div>
        <div className="pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-24" />
          </div>
        </div>
      </div>
    </div>
  );
}
