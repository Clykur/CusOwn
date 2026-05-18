'use client';

import { skeletonBase } from '../base-skeleton';

export function DashboardStatSkeleton() {
  return (
    <div
      className="bg-white rounded-xl border border-gray-200 p-4 skeleton-shimmer"
      aria-busy="true"
    >
      <div className={`h-4 ${skeletonBase} w-16 mb-2`} />
      <div className={`h-8 ${skeletonBase} w-12`} />
    </div>
  );
}

export function SalonCardSkeleton() {
  return (
    <div
      className="bg-white rounded-xl border-2 border-gray-200 p-6 skeleton-shimmer h-full flex flex-col"
      aria-busy="true"
    >
      <div className="flex justify-between mb-3">
        <div className={`h-6 ${skeletonBase} w-2/3`} />
        <div className={`h-5 ${skeletonBase} w-16 rounded-full`} />
      </div>
      <div className={`h-4 ${skeletonBase} w-1/2 mb-4`} />
      <div className={`h-4 ${skeletonBase} w-full mb-2`} />
      <div className={`h-4 ${skeletonBase} w-3/4 flex-1`} />
    </div>
  );
}

export function SlotGridSkeleton() {
  return (
    <div className="space-y-2" aria-busy="true">
      <div className={`h-4 ${skeletonBase} w-24 mb-3`} />
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className={`h-10 ${skeletonBase} rounded-lg`} />
        ))}
      </div>
    </div>
  );
}
