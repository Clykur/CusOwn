'use client';

import AnalyticsSkeleton from '@/components/analytics/AnalyticsSkeleton';
import { skeletonBase } from '../base-skeleton';

export function OwnerDashboardSkeleton() {
  return (
    <div className="w-full pb-24 flex flex-col gap-6" aria-busy="true">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-2 gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-lg p-6 skeleton-shimmer">
            <div className={`text-sm text-slate-500 h-4 ${skeletonBase} w-24 mb-2 rounded`} />
            <div className={`h-8 ${skeletonBase} w-12 rounded`} />
          </div>
        ))}
      </div>
      <div>
        <div className={`h-6 ${skeletonBase} w-40 mb-4 rounded`} />
        <div className="bg-white border border-slate-200 rounded-lg p-6 skeleton-shimmer">
          <div className="flex items-center justify-between mb-4">
            <div className={`h-5 ${skeletonBase} w-20 rounded`} />
            <div className="flex gap-3">
              <div className={`h-9 w-9 ${skeletonBase} rounded-lg`} />
              <div className={`h-9 ${skeletonBase} w-32 rounded-lg`} />
            </div>
          </div>
          <div className="border-t border-slate-200 pt-4">
            <div className="hidden lg:block">
              <div className="bg-slate-50 px-6 py-3 flex gap-4 border-b border-slate-200">
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <div key={i} className={`h-4 ${skeletonBase} w-16 rounded`} />
                ))}
              </div>
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="px-6 py-4 flex gap-4 border-b border-slate-100 last:border-0"
                >
                  <div className={`h-4 ${skeletonBase} w-28 rounded`} />
                  <div className={`h-4 ${skeletonBase} w-24 rounded`} />
                  <div className={`h-5 ${skeletonBase} w-16 rounded`} />
                  <div className={`h-4 ${skeletonBase} w-24 rounded`} />
                  <div className={`h-4 ${skeletonBase} w-20 rounded`} />
                  <div className={`h-8 ${skeletonBase} w-16 rounded`} />
                </div>
              ))}
            </div>
            <div className="lg:hidden space-y-4 pt-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="border border-slate-200 rounded-lg p-4">
                  <div className={`h-4 ${skeletonBase} w-32 mb-2 rounded`} />
                  <div className={`h-4 ${skeletonBase} w-24 mb-2 rounded`} />
                  <div className={`h-8 ${skeletonBase} w-full rounded`} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function OwnerBusinessesSkeleton() {
  return (
    <div className="flex w-full flex-col gap-4 pb-24 md:gap-6" aria-busy="true">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="rounded-xl border border-slate-200/90 bg-white p-4 skeleton-shimmer md:rounded-lg md:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div
                  className={`mb-2 h-4 ${skeletonBase} w-40 max-w-full rounded md:h-5 md:w-48`}
                />
                <div className={`h-3 ${skeletonBase} w-32 max-w-full rounded md:h-4 md:w-36`} />
              </div>
              <div className={`h-4 w-3 shrink-0 ${skeletonBase} rounded`} />
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 md:mt-6 md:pt-4">
              <div className={`h-3 ${skeletonBase} w-28 rounded md:h-4 md:w-32`} />
              <div className={`h-3 ${skeletonBase} w-14 rounded md:h-4 md:w-16`} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function OwnerSetupSkeleton() {
  return (
    <div className="w-full pb-24" aria-busy="true">
      <div className="bg-white border border-slate-200 rounded-lg p-6 md:p-8 skeleton-shimmer">
        <div className="mb-6 text-center">
          <div className={`h-14 w-14 ${skeletonBase} rounded-full mx-auto mb-3`} />
          <div className={`h-6 ${skeletonBase} w-56 mx-auto mb-2 rounded`} />
          <div className={`h-4 ${skeletonBase} w-72 max-w-full mx-auto rounded`} />
        </div>
        <div className={`h-4 ${skeletonBase} w-full max-w-md mb-4 rounded`} />
        <div className="space-y-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i}>
              <div className={`h-4 ${skeletonBase} w-28 mb-2 rounded`} />
              <div className={`h-10 ${skeletonBase} w-full rounded-lg`} />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 pt-6">
          <div className={`h-11 ${skeletonBase} w-full rounded-lg`} />
          <div className={`h-4 ${skeletonBase} w-36 rounded`} />
        </div>
      </div>
    </div>
  );
}

export function OwnerProfileSkeleton() {
  const fieldRow = (key: number) => (
    <div
      key={key}
      className="grid grid-cols-1 gap-1.5 px-4 py-3 sm:grid-cols-[minmax(0,7.5rem)_1fr] sm:items-start sm:gap-x-4"
    >
      <div className={`h-3 w-20 rounded ${skeletonBase}`} />
      <div className={`h-5 w-full max-w-sm rounded ${skeletonBase}`} />
    </div>
  );

  return (
    <div
      className="flex w-full flex-col gap-5 pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:gap-8 md:pb-8"
      aria-busy="true"
    >
      <section className="skeleton-shimmer space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
          <div className="flex flex-col items-center gap-4 sm:flex-row sm:gap-6">
            <div className={`h-24 w-24 shrink-0 rounded-full sm:h-28 sm:w-28 ${skeletonBase}`} />
            <div className="flex w-full flex-col items-center gap-2 sm:items-start">
              <div className={`h-5 w-44 max-w-full rounded ${skeletonBase}`} />
              <div className={`h-4 w-52 max-w-full rounded ${skeletonBase}`} />
            </div>
          </div>
          <div className={`h-10 w-full rounded-lg sm:w-28 ${skeletonBase}`} />
        </div>

        <div className="space-y-6">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50">
            <div className="border-b border-slate-200 bg-white/90 px-4 py-3">
              <div className={`h-3 w-16 rounded ${skeletonBase}`} />
            </div>
            <div className="divide-y divide-slate-100">{[1, 2, 3].map(fieldRow)}</div>
          </div>
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-50/50">
            <div className="border-b border-slate-200 bg-white/90 px-4 py-3">
              <div className={`h-3 w-20 rounded ${skeletonBase}`} />
            </div>
            <div className="divide-y divide-slate-100">{[4, 5, 6].map(fieldRow)}</div>
          </div>
        </div>
      </section>

      <section className="skeleton-shimmer rounded-xl border border-red-200 bg-red-50/40 p-4 shadow-sm sm:rounded-lg sm:p-6">
        <div className={`mb-2 h-5 w-36 rounded ${skeletonBase}`} />
        <div className={`mb-4 h-4 w-full max-w-sm rounded ${skeletonBase}`} />
        <div className={`mb-4 h-16 w-full rounded-lg ${skeletonBase}`} />
        <div className={`h-10 w-full max-w-xs rounded-lg sm:w-40 ${skeletonBase}`} />
      </section>

      <div className="flex justify-stretch px-0.5 lg:hidden">
        <div className={`mx-auto h-12 w-full max-w-lg rounded-xl ${skeletonBase}`} />
      </div>
    </div>
  );
}

export function OwnerAnalyticsSkeleton() {
  return (
    <div
      className="w-full pb-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:pb-16"
      aria-busy="true"
    >
      <div className="mb-6 md:mb-8">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className={`h-8 ${skeletonBase} w-40 max-w-[85%] rounded`} />
            <div className={`mt-2 hidden h-5 ${skeletonBase} w-full max-w-md rounded md:block`} />
          </div>
          <div className="shrink-0 pt-0.5 md:hidden">
            <div className="flex items-center gap-2">
              <div className={`h-10 w-10 shrink-0 rounded-xl md:h-11 md:w-11 ${skeletonBase}`} />
              <div className={`h-10 w-10 shrink-0 rounded-xl md:h-11 md:w-11 ${skeletonBase}`} />
            </div>
          </div>
        </div>
        <div className={`mt-2 h-5 ${skeletonBase} w-full max-w-md rounded md:hidden`} />
      </div>
      <AnalyticsSkeleton />
    </div>
  );
}

export function BusinessCreateSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50 py-12" aria-busy="true">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <div className={`h-9 ${skeletonBase} w-64 rounded`} />
          <div className={`mt-2 h-5 ${skeletonBase} w-96 max-w-full rounded`} />
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-6 md:p-8 skeleton-shimmer">
          <div className="space-y-6">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i}>
                <div className={`h-4 ${skeletonBase} w-32 mb-2 rounded`} />
                <div className={`h-11 ${skeletonBase} w-full rounded-lg`} />
              </div>
            ))}
          </div>
          <div className="mt-8 flex flex-col gap-3">
            <div className={`h-12 ${skeletonBase} w-full rounded-lg`} />
          </div>
        </div>
      </div>
    </div>
  );
}

const cardShell =
  'rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] sm:p-5 md:rounded-lg md:shadow-none md:ring-0 lg:p-6';

/**
 * `/owner/[bookingLink]` — mirrors loaded page: title, business card, services, QR, photos, slots tabs, reviews.
 * Breadcrumb is rendered by the page or route loading UI.
 */
export function OwnerSalonDetailLoadingBody() {
  return (
    <div
      className="flex w-full flex-col gap-5 md:gap-6"
      aria-busy="true"
      aria-label="Loading business details"
    >
      {/* Page title (salon name) */}
      <div className="space-y-1">
        <div
          className={`h-8 ${skeletonBase} w-[min(100%,18rem)] rounded-lg sm:w-80 md:h-9 md:max-w-xl`}
        />
      </div>

      {/* Business details card */}
      <div className={`${cardShell} skeleton-shimmer`}>
        <div className="mb-4 flex flex-row items-center justify-between gap-3 border-b border-slate-100 pb-3 md:mb-5 md:pb-4">
          <div className={`h-5 ${skeletonBase} w-36 rounded md:h-6`} />
          <div className="flex shrink-0 gap-2">
            <div className={`h-9 ${skeletonBase} w-[4.5rem] rounded-lg`} />
            <div className={`h-9 ${skeletonBase} w-[4.5rem] rounded-lg`} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-4 md:gap-x-8 md:gap-y-5">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="space-y-2">
              <div className={`h-3 ${skeletonBase} w-24 rounded`} />
              <div className={`h-4 ${skeletonBase} w-full max-w-[10rem] rounded`} />
            </div>
          ))}
          <div className="col-span-2 space-y-2">
            <div className={`h-3 ${skeletonBase} w-16 rounded`} />
            <div className={`h-4 ${skeletonBase} w-full max-w-md rounded`} />
          </div>
        </div>
      </div>

      {/* Services */}
      <div className={`${cardShell} skeleton-shimmer`}>
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className={`h-7 ${skeletonBase} w-28 rounded md:w-32`} />
          <div className={`h-10 ${skeletonBase} w-36 rounded-lg`} />
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {[1, 2].map((i) => (
            <div key={i} className={`h-28 rounded-xl border border-slate-100 ${skeletonBase}`} />
          ))}
        </div>
      </div>

      {/* QR Code */}
      <div className={`${cardShell} skeleton-shimmer`}>
        <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-start">
          <div
            className={`h-40 w-40 shrink-0 rounded-xl ${skeletonBase} sm:mx-0 lg:h-48 lg:w-48`}
          />
          <div className="w-full flex-1 space-y-3 text-center sm:text-left">
            <div className={`mx-auto h-6 ${skeletonBase} w-24 rounded sm:mx-0 md:h-7`} />
            <div className={`mx-auto h-4 ${skeletonBase} w-full max-w-md rounded sm:mx-0`} />
            <div className={`mx-auto h-4 ${skeletonBase} w-48 rounded sm:mx-0`} />
            <div className={`mx-auto h-11 w-full max-w-xs ${skeletonBase} rounded-lg sm:mx-0`} />
          </div>
        </div>
      </div>

      {/* Shop photos */}
      <div className={`${cardShell} skeleton-shimmer`}>
        <div className={`mb-1 h-5 ${skeletonBase} w-28 rounded md:h-6`} />
        <div className={`mb-4 h-4 ${skeletonBase} w-full max-w-sm rounded`} />
        <div className="mb-5 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50/50 p-4 md:rounded-xl">
          <div className={`h-20 ${skeletonBase} rounded-xl`} />
        </div>
        <div className="grid grid-cols-3 gap-1.5 sm:gap-2 md:gap-3 lg:grid-cols-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`aspect-[4/3] ${skeletonBase} rounded-lg`} />
          ))}
        </div>
      </div>

      {/* Slots / Downtime card */}
      <div className="overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.06)] ring-1 ring-slate-900/[0.04] md:rounded-lg md:shadow-none md:ring-0 skeleton-shimmer">
        <div className="flex gap-1 border-b border-slate-200 bg-slate-100 p-1.5">
          <div className={`h-10 flex-1 ${skeletonBase} rounded-lg`} />
          <div className={`h-10 flex-1 ${skeletonBase} rounded-lg`} />
        </div>
        <div className="p-4 lg:p-6">
          <div className={`mb-2 h-3 ${skeletonBase} w-20 rounded md:mb-2 md:h-4 md:w-24`} />
          <div className={`mb-4 h-11 max-w-xs ${skeletonBase} rounded-xl`} />
          {/* Mobile: chessboard-style slot grid */}
          <div className="grid grid-cols-3 gap-1.5 md:hidden">
            {Array.from({ length: 15 }).map((_, i) => (
              <div key={i} className={`h-12 ${skeletonBase} rounded-lg`} />
            ))}
          </div>
          {/* Desktop: kanban columns */}
          <div className="hidden gap-4 md:grid md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border border-slate-200 bg-gray-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className={`h-4 ${skeletonBase} w-20 rounded`} />
                  <div className={`h-5 w-8 ${skeletonBase} rounded-full`} />
                </div>
                <div className="space-y-2">
                  {[1, 2, 3, 4].map((j) => (
                    <div key={j} className={`h-12 ${skeletonBase} rounded-lg`} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Customer reviews */}
      <div
        className={`${cardShell} skeleton-shimmer md:rounded-xl md:shadow-sm md:ring-1 md:ring-slate-100/80`}
      >
        <div className={`mb-1 h-5 ${skeletonBase} w-40 rounded`} />
        <div className={`mb-4 h-4 ${skeletonBase} w-64 max-w-full rounded`} />
        <div
          className={`min-h-[100px] rounded-xl border border-dashed border-slate-200 bg-slate-50/60 ${skeletonBase}`}
        />
      </div>
    </div>
  );
}
