'use client';

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
                  <div className={`h-4 ${skeletonBase} w-24 rounded`} />
                  <div className={`h-5 ${skeletonBase} w-20 rounded mt-2`} />
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
    <div className="w-full pb-24 flex flex-col gap-6" aria-busy="true">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-white border border-slate-200 rounded-lg p-6 skeleton-shimmer">
            <div className="flex items-start justify-between">
              <div>
                <div className={`h-5 ${skeletonBase} w-48 rounded mb-2`} />
                <div className={`h-4 ${skeletonBase} w-36 rounded`} />
              </div>
              <div className={`h-5 ${skeletonBase} w-4 rounded`} />
            </div>
            <div className="border-t border-slate-200 mt-6 pt-4 flex items-center justify-between">
              <div className={`h-4 ${skeletonBase} w-24 rounded`} />
              <div className={`h-4 ${skeletonBase} w-20 rounded`} />
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
  return (
    <div className="w-full pb-24 flex flex-col gap-8" aria-busy="true">
      <section className="rounded-lg border border-slate-200 bg-white p-6 skeleton-shimmer">
        <div className="flex justify-between items-start mb-6">
          <div>
            <div className={`h-5 ${skeletonBase} w-40 rounded`} />
            <div className={`h-4 ${skeletonBase} w-52 rounded mt-1`} />
          </div>
          <div className={`h-10 ${skeletonBase} w-28 rounded-lg`} />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i}>
              <div className={`h-3 ${skeletonBase} w-20 rounded mb-2`} />
              <div className={`h-10 ${skeletonBase} w-full rounded-lg`} />
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 skeleton-shimmer">
        <div className={`h-5 ${skeletonBase} w-24 rounded mb-1`} />
        <div className={`h-4 ${skeletonBase} w-40 rounded mb-6`} />
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
              <div className={`h-3 ${skeletonBase} w-28 rounded`} />
              <div className={`h-8 ${skeletonBase} w-12 rounded mt-2`} />
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-lg border border-slate-200 bg-white p-6 skeleton-shimmer">
        <div className="flex justify-between items-center mb-6">
          <div>
            <div className={`h-5 ${skeletonBase} w-36 rounded`} />
            <div className={`h-4 ${skeletonBase} w-44 rounded mt-1`} />
          </div>
          <div className={`h-10 ${skeletonBase} w-28 rounded-lg`} />
        </div>
        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="bg-slate-50 px-5 py-3.5 flex gap-4">
            {[1, 2, 3, 4].map((j) => (
              <div key={j} className={`h-4 ${skeletonBase} flex-1 rounded`} />
            ))}
          </div>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="px-5 py-4 flex gap-4 border-t border-slate-100">
              <div className={`h-4 ${skeletonBase} w-28 rounded`} />
              <div className={`h-4 ${skeletonBase} w-24 rounded`} />
              <div className={`h-4 ${skeletonBase} w-20 rounded`} />
              <div className={`h-5 ${skeletonBase} w-14 rounded`} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

export function OwnerAnalyticsSkeleton() {
  return (
    <div className="w-full pb-24 space-y-6" aria-busy="true">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm skeleton-shimmer">
        <div className={`h-6 ${skeletonBase} w-56 rounded`} />
        <div className={`mt-2 h-4 ${skeletonBase} w-80 max-w-full rounded`} />
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className={`h-10 ${skeletonBase} rounded-lg`} />
          <div className={`h-10 ${skeletonBase} rounded-lg`} />
          <div className={`h-10 ${skeletonBase} rounded-lg`} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className={`h-40 ${skeletonBase} rounded-xl`} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div className={`h-80 ${skeletonBase} rounded-xl`} />
        <div className={`h-80 ${skeletonBase} rounded-xl`} />
      </div>
      <div className={`h-72 ${skeletonBase} rounded-xl`} />
      <div className={`h-72 ${skeletonBase} rounded-xl`} />
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
