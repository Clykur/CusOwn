'use client';

const skeletonBase = 'bg-gray-200 rounded skeleton-shimmer';

/** Base skeleton block; use for consistent spacing and a11y. */
export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`${skeletonBase} ${className}`} aria-busy="true" aria-hidden="true" />;
}

export function SkeletonCard() {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg p-6 skeleton-shimmer"
      aria-busy="true"
    >
      <div className={`h-4 ${skeletonBase} w-1/4 mb-4`}></div>
      <div className={`h-8 ${skeletonBase} w-1/2`}></div>
    </div>
  );
}

export function SkeletonTable() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg overflow-hidden" aria-busy="true">
      <div className="p-6 space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="flex items-center space-x-4 skeleton-shimmer">
            <div className={`h-12 ${skeletonBase} w-1/4`}></div>
            <div className={`h-12 ${skeletonBase} w-1/4`}></div>
            <div className={`h-12 ${skeletonBase} w-1/4`}></div>
            <div className={`h-12 ${skeletonBase} w-1/4`}></div>
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
          <div className={`h-5 ${skeletonBase} w-3/4 mb-3`}></div>
          <div className={`h-4 ${skeletonBase} w-1/2 mb-2`}></div>
          <div className={`h-4 ${skeletonBase} w-1/3`}></div>
        </div>
      ))}
    </div>
  );
}

// ----- Page-level skeletons (match route layout hierarchy) -----

export function HomeSkeleton() {
  return (
    <div className="min-h-screen bg-white" aria-busy="true">
      <section className="pt-20 pb-20 sm:pt-28 sm:pb-28 px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className={`h-8 ${skeletonBase} w-32 mx-auto mb-8`} />
          <div className={`h-14 sm:h-16 ${skeletonBase} w-full max-w-2xl mx-auto mb-6`} />
          <div className={`h-6 ${skeletonBase} w-3/4 max-w-xl mx-auto mb-12`} />
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <div className={`h-14 ${skeletonBase} w-48 rounded-lg`} />
            <div className={`h-14 ${skeletonBase} w-48 rounded-lg`} />
          </div>
        </div>
      </section>
      <section className="py-24 px-6 lg:px-8">
        <div className={`h-10 ${skeletonBase} w-64 mx-auto mb-8`} />
        <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="bg-white rounded-2xl border border-gray-200 p-8 skeleton-shimmer"
            >
              <div className={`h-12 w-12 ${skeletonBase} rounded-lg mb-6`} />
              <div className={`h-7 ${skeletonBase} w-2/3 mb-4`} />
              <div className={`h-4 ${skeletonBase} w-full mb-2`} />
              <div className={`h-4 ${skeletonBase} w-4/5`} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function CategoryGridSkeleton() {
  return (
    <div className="min-h-screen bg-white flex" aria-busy="true">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className={`h-4 ${skeletonBase} w-24 mb-6`} />
          <div className="text-center mb-12">
            <div className={`h-10 ${skeletonBase} w-64 mx-auto mb-4`} />
            <div className={`h-5 ${skeletonBase} w-80 max-w-2xl mx-auto`} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-2xl border-2 border-gray-200 p-8 skeleton-shimmer">
                <div className={`h-20 w-20 ${skeletonBase} rounded-2xl mx-auto mb-6`} />
                <div className={`h-8 ${skeletonBase} w-1/2 mx-auto mb-3`} />
                <div className={`h-4 ${skeletonBase} w-full mb-6`} />
                <div className={`h-10 ${skeletonBase} w-3/4`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function SalonListSkeleton() {
  return (
    <div className="min-h-screen bg-white flex" aria-busy="true">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className={`h-4 ${skeletonBase} w-32 mb-6`} />
          <div className="flex flex-col sm:flex-row gap-4 mb-8">
            <div className={`h-10 ${skeletonBase} w-full sm:w-64 rounded-lg`} />
            <div className={`h-10 ${skeletonBase} w-full sm:w-48 rounded-lg`} />
          </div>
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border-2 border-gray-200 p-6 skeleton-shimmer"
              >
                <div className="flex justify-between mb-3">
                  <div className={`h-6 ${skeletonBase} w-2/3`} />
                  <div className={`h-5 ${skeletonBase} w-16 rounded-full`} />
                </div>
                <div className={`h-4 ${skeletonBase} w-1/2 mb-4`} />
                <div className={`h-4 ${skeletonBase} w-full mb-2`} />
                <div className={`h-4 ${skeletonBase} w-3/4`} />
              </div>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-8">
            <div className={`h-10 ${skeletonBase} w-10 rounded`} />
            <div className={`h-10 ${skeletonBase} w-10 rounded`} />
          </div>
        </div>
      </div>
    </div>
  );
}

export function BookingPageSkeleton() {
  return (
    <div className="min-h-screen bg-white py-12 px-4" aria-busy="true">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8 skeleton-shimmer">
          <div className={`h-9 ${skeletonBase} w-3/4 mb-2`} />
          <div className={`h-5 ${skeletonBase} w-48 mb-8`} />
          <div className={`h-4 ${skeletonBase} w-24 mb-2`} />
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className={`h-12 ${skeletonBase} rounded-lg`} />
            <div className={`h-12 ${skeletonBase} rounded-lg`} />
          </div>
          <div className={`h-4 ${skeletonBase} w-20 mb-2`} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={`h-10 ${skeletonBase} rounded-lg`} />
            ))}
          </div>
          <div className={`h-4 ${skeletonBase} w-24 mb-2`} />
          <div className={`h-12 ${skeletonBase} w-full mb-6 rounded-lg`} />
          <div className={`h-4 ${skeletonBase} w-28 mb-2`} />
          <div className={`h-12 ${skeletonBase} w-full mb-6 rounded-lg`} />
          <div className={`h-12 ${skeletonBase} w-full rounded-lg`} />
        </div>
      </div>
    </div>
  );
}

export function CustomerDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-white flex" aria-busy="true">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className={`h-4 ${skeletonBase} w-40 mb-6`} />
          <div className="mb-8">
            <div className={`h-9 ${skeletonBase} w-56 mb-2`} />
            <div className={`h-5 ${skeletonBase} w-72`} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl shadow-md p-6 border border-gray-200 skeleton-shimmer"
              >
                <div className="flex items-center gap-3">
                  <div className={`h-12 w-12 ${skeletonBase} rounded-lg`} />
                  <div className="flex-1">
                    <div className={`h-5 ${skeletonBase} w-16 mb-2`} />
                    <div className={`h-4 ${skeletonBase} w-24`} />
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className={`h-6 ${skeletonBase} w-32 mb-4`} />
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-gray-50 border-2 border-gray-200 rounded-2xl p-4 sm:p-6 skeleton-shimmer"
              >
                <div className="flex justify-between mb-4">
                  <div className={`h-6 ${skeletonBase} w-2/3`} />
                  <div className={`h-6 ${skeletonBase} w-20 rounded-full`} />
                </div>
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div className={`h-4 ${skeletonBase} w-24`} />
                  <div className={`h-4 ${skeletonBase} w-20`} />
                </div>
                <div className="flex gap-3">
                  <div className={`h-10 ${skeletonBase} w-28 rounded-xl`} />
                  <div className={`h-10 ${skeletonBase} w-28 rounded-xl`} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OwnerDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-white flex" aria-busy="true">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className={`h-4 ${skeletonBase} w-36 mb-6`} />
          <div className="flex flex-wrap gap-2 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className={`h-10 ${skeletonBase} w-24 rounded-lg`} />
            ))}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-xl border border-gray-200 p-4 skeleton-shimmer"
              >
                <div className={`h-4 ${skeletonBase} w-16 mb-2`} />
                <div className={`h-8 ${skeletonBase} w-12`} />
              </div>
            ))}
          </div>
          <div className={`h-6 ${skeletonBase} w-40 mb-4`} />
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden skeleton-shimmer">
            <div className="p-4 border-b border-gray-200 flex gap-4">
              <div className={`h-4 ${skeletonBase} w-20`} />
              <div className={`h-4 ${skeletonBase} w-24`} />
              <div className={`h-4 ${skeletonBase} w-16`} />
            </div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="p-4 border-b border-gray-100 flex items-center gap-4">
                <div className={`h-4 ${skeletonBase} w-32`} />
                <div className={`h-4 ${skeletonBase} w-20`} />
                <div className={`h-4 ${skeletonBase} w-16`} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div className="min-h-screen bg-white flex" aria-busy="true">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className={`h-4 ${skeletonBase} w-28 mb-6`} />
          <div className="flex flex-wrap gap-2 mb-8">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className={`h-10 ${skeletonBase} w-24 rounded-lg`} />
            ))}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="bg-white rounded-lg border border-gray-200 p-4 skeleton-shimmer"
              >
                <div className={`h-4 ${skeletonBase} w-20 mb-2`} />
                <div className={`h-8 ${skeletonBase} w-14`} />
              </div>
            ))}
          </div>
          <div className={`h-6 ${skeletonBase} w-48 mb-4`} />
          <div className="bg-white border border-gray-200 rounded-lg overflow-hidden skeleton-shimmer">
            <div className="p-4 border-b border-gray-200 grid grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-4 ${skeletonBase} w-20`} />
              ))}
            </div>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="p-4 border-b border-gray-100 grid grid-cols-4 gap-4">
                {[1, 2, 3, 4].map((j) => (
                  <div key={j} className={`h-4 ${skeletonBase} w-full`} />
                ))}
              </div>
            ))}
          </div>
        </div>
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

export function SelectRoleSkeleton() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4" aria-busy="true">
      <div className="max-w-2xl w-full">
        <div className={`h-9 ${skeletonBase} w-48 mx-auto mb-2`} />
        <div className={`h-5 ${skeletonBase} w-72 mx-auto mb-12`} />
        <div className="grid sm:grid-cols-2 gap-6">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-2xl border-2 border-gray-200 p-8 skeleton-shimmer">
              <div className={`h-14 w-14 ${skeletonBase} rounded-xl mb-6`} />
              <div className={`h-7 ${skeletonBase} w-2/3 mb-4`} />
              <div className={`h-4 ${skeletonBase} w-full mb-2`} />
              <div className={`h-4 ${skeletonBase} w-4/5`} />
            </div>
          ))}
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

export function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-white flex" aria-busy="true">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className={`h-4 ${skeletonBase} w-20 mb-6`} />
          <div className="bg-white rounded-xl border border-gray-200 p-6 skeleton-shimmer">
            <div className="flex items-center gap-4 mb-6">
              <div className={`h-16 w-16 ${skeletonBase} rounded-full`} />
              <div>
                <div className={`h-6 ${skeletonBase} w-40 mb-2`} />
                <div className={`h-4 ${skeletonBase} w-32`} />
              </div>
            </div>
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i}>
                  <div className={`h-4 ${skeletonBase} w-24 mb-2`} />
                  <div className={`h-10 ${skeletonBase} w-full rounded-lg`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginSkeleton() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4" aria-busy="true">
      <div className="max-w-md w-full">
        <div className={`h-9 ${skeletonBase} w-32 mx-auto mb-2`} />
        <div className={`h-5 ${skeletonBase} w-48 mx-auto mb-8`} />
        <div className="bg-white rounded-lg border border-gray-200 p-6 skeleton-shimmer">
          <div className={`h-12 ${skeletonBase} w-full rounded-lg mb-4`} />
          <div className={`h-12 ${skeletonBase} w-full rounded-lg mb-6`} />
          <div className={`h-12 ${skeletonBase} w-full rounded-lg`} />
        </div>
      </div>
    </div>
  );
}

export function BookingStatusSkeleton() {
  return (
    <div className="min-h-screen bg-white flex" aria-busy="true">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className={`h-4 ${skeletonBase} w-28 mb-6`} />
          <div className="bg-white rounded-xl border border-gray-200 p-6 skeleton-shimmer">
            <div className={`h-6 ${skeletonBase} w-24 mb-4`} />
            <div className={`h-7 ${skeletonBase} w-2/3 mb-4`} />
            <div className="grid grid-cols-2 gap-4 mb-6">
              <div className={`h-4 ${skeletonBase} w-20`} />
              <div className={`h-4 ${skeletonBase} w-24`} />
            </div>
            <div className={`h-10 ${skeletonBase} w-32 rounded-lg`} />
          </div>
        </div>
      </div>
    </div>
  );
}

/** Minimal skeleton for redirect/deprecated pages. */
export function RedirectSkeleton() {
  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4" aria-busy="true">
      <div className="text-center">
        <div className={`h-5 ${skeletonBase} w-48 mx-auto mb-4`} />
        <div className={`h-4 w-4 ${skeletonBase} rounded-full mx-auto`} />
      </div>
    </div>
  );
}

// ----- Component-level skeletons -----

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

export function TableRowSkeleton({ cols = 4 }: { cols?: number }) {
  return (
    <div
      className="flex items-center gap-4 p-4 border-b border-gray-100 skeleton-shimmer"
      aria-busy="true"
    >
      {Array.from({ length: cols }).map((_, i) => (
        <div key={i} className={`h-4 ${skeletonBase} flex-1 min-w-0`} />
      ))}
    </div>
  );
}

/** Table skeleton for admin tabs (header + rows). */
export function AdminTableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number } = {}) {
  return (
    <div
      className="bg-white border border-gray-200 rounded-lg overflow-hidden skeleton-shimmer"
      aria-busy="true"
    >
      <div className="bg-gray-50 px-6 py-3 flex gap-4 border-b border-gray-200">
        {Array.from({ length: cols }).map((_, i) => (
          <div key={i} className={`h-4 ${skeletonBase} flex-1 min-w-0`} />
        ))}
      </div>
      <div className="divide-y divide-gray-100">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="px-6 py-4 flex gap-4">
            {Array.from({ length: cols }).map((_, j) => (
              <div key={j} className={`h-4 ${skeletonBase} flex-1 min-w-0`} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Inline list skeleton for audit logs / cards. */
export function ListSkeleton({ items = 4 }: { items?: number } = {}) {
  return (
    <div className="space-y-3 skeleton-shimmer" aria-busy="true">
      {Array.from({ length: items }).map((_, i) => (
        <div key={i} className="flex gap-4 p-4 bg-white border border-gray-200 rounded-lg">
          <div className={`h-4 ${skeletonBase} w-24 flex-shrink-0`} />
          <div className={`h-4 ${skeletonBase} flex-1`} />
          <div className={`h-4 ${skeletonBase} w-20 flex-shrink-0`} />
        </div>
      ))}
    </div>
  );
}
