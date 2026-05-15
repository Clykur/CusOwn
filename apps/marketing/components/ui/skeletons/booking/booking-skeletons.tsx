'use client';

import { skeletonBase } from '../base-skeleton';

export function BookingPageSkeleton() {
  return (
    <div className="w-full" aria-busy="true">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm skeleton-shimmer">
        <div className={`h-7 ${skeletonBase} w-3/4 mb-2`} />
        <div className={`h-5 ${skeletonBase} w-48 mb-8`} />
        <div className={`h-4 ${skeletonBase} w-24 mb-2`} />
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`h-12 ${skeletonBase} rounded-xl`} />
          <div className={`h-12 ${skeletonBase} rounded-xl`} />
        </div>
        <div className={`h-4 ${skeletonBase} w-20 mb-2`} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`h-10 ${skeletonBase} rounded-xl`} />
          ))}
        </div>
        <div className={`h-4 ${skeletonBase} w-24 mb-2`} />
        <div className={`h-12 ${skeletonBase} w-full mb-6 rounded-xl`} />
        <div className={`h-4 ${skeletonBase} w-28 mb-2`} />
        <div className={`h-12 ${skeletonBase} w-full mb-6 rounded-xl`} />
        <div className={`h-12 ${skeletonBase} w-full rounded-xl`} />
      </div>
    </div>
  );
}

export function BookingStatusSkeleton() {
  return (
    <div className="w-full" aria-busy="true">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm skeleton-shimmer">
        <div className={`h-4 ${skeletonBase} w-28 mb-6`} />
        <div className={`h-7 ${skeletonBase} w-2/3 mb-4`} />
        <div className="grid grid-cols-2 gap-4 mb-6">
          <div className={`h-4 ${skeletonBase} w-20`} />
          <div className={`h-4 ${skeletonBase} w-24`} />
        </div>
        <div className={`h-10 ${skeletonBase} w-32 rounded-xl`} />
      </div>
    </div>
  );
}

export function AcceptRejectSkeleton() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4" aria-busy="true">
      <div className="max-w-md w-full">
        <div className={`h-4 ${skeletonBase} w-full mb-6`} />
        <div className="bg-white rounded-lg shadow-lg p-8 skeleton-shimmer">
          <div className={`h-16 w-16 ${skeletonBase} rounded-full mx-auto mb-4`} />
          <div className={`h-7 ${skeletonBase} w-3/4 mx-auto mb-4`} />
          <div className={`h-4 ${skeletonBase} w-full mb-6`} />
          <div className={`h-12 ${skeletonBase} w-full rounded-lg`} />
        </div>
      </div>
    </div>
  );
}

export function SetupSkeleton() {
  return (
    <div className="min-h-screen bg-white flex" aria-busy="true">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className={`h-4 ${skeletonBase} w-24 mb-6`} />
          <div className={`h-9 ${skeletonBase} w-56 mb-2`} />
          <div className={`h-5 ${skeletonBase} w-80 mb-8`} />
          <div className="space-y-6">
            {[1, 2, 3, 4].map((i) => (
              <div key={i}>
                <div className={`h-4 ${skeletonBase} w-32 mb-2`} />
                <div className={`h-12 ${skeletonBase} w-full rounded-lg`} />
              </div>
            ))}
          </div>
          <div className={`h-12 ${skeletonBase} w-40 rounded-lg mt-8`} />
        </div>
      </div>
    </div>
  );
}

/** Lazy `calendar-grid` strip — slate pulse cells (matches previous inline placeholder). */
export function CalendarGridLoadingSkeleton({ cells = 14 }: { cells?: number }) {
  return (
    <div className="grid grid-cols-7 gap-1 mb-4" aria-busy="true">
      {Array.from({ length: cells }).map((_, i) => (
        <div key={i} className="h-10 bg-slate-100 rounded animate-pulse" />
      ))}
    </div>
  );
}
