'use client';

export const skeletonBase = 'bg-gray-200 rounded skeleton-shimmer';

export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`${skeletonBase} ${className}`} aria-busy="true" aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-6 skeleton-shimmer"
      aria-busy="true"
    >
      <div className={`h-4 ${skeletonBase} w-1/4 mb-4`} />
      <div className={`h-8 ${skeletonBase} w-1/2`} />
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden" aria-busy="true">
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center space-x-4 skeleton-shimmer">
            <div className={`h-12 ${skeletonBase} w-1/4`} />
            <div className={`h-12 ${skeletonBase} w-1/4`} />
            <div className={`h-12 ${skeletonBase} w-1/4`} />
            <div className={`h-12 ${skeletonBase} w-1/4`} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCardList() {
  return (
    <div className="space-y-4" aria-busy="true">
      {[1, 2, 3].map((i) => (
        <div key={i} className="bg-white border border-gray-200 rounded-lg p-4 skeleton-shimmer">
          <div className={`h-5 ${skeletonBase} w-3/4 mb-3`} />
          <div className={`h-4 ${skeletonBase} w-1/2 mb-2`} />
          <div className={`h-4 ${skeletonBase} w-1/3`} />
        </div>
      ))}
    </div>
  );
}
