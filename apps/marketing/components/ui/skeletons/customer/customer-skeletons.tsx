'use client';

import { skeletonBase } from '../base-skeleton';

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

export function BusinessProfileSkeleton() {
  return (
    <div className="min-h-screen bg-slate-50" aria-busy="true">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className={`h-4 ${skeletonBase} w-24 mb-6 rounded`} />
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden skeleton-shimmer">
          <div className="aspect-[3/1] w-full bg-slate-200" />
          <div className="p-6 md:p-8">
            <div className="flex items-start gap-4 mb-6">
              <div className={`h-16 w-16 ${skeletonBase} rounded-full flex-shrink-0`} />
              <div className="flex-1">
                <div className={`h-7 ${skeletonBase} w-2/3 mb-2 rounded`} />
                <div className={`h-5 ${skeletonBase} w-1/2 rounded`} />
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="rounded-xl border border-slate-200 p-4">
                  <div className={`h-3 ${skeletonBase} w-16 mb-2 rounded`} />
                  <div className={`h-5 ${skeletonBase} w-12 rounded`} />
                </div>
              ))}
            </div>
            <div className="mb-8">
              <div className={`h-5 ${skeletonBase} w-24 mb-4 rounded`} />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-3 border-b border-slate-100"
                  >
                    <div className="flex-1">
                      <div className={`h-4 ${skeletonBase} w-32 mb-1 rounded`} />
                      <div className={`h-3 ${skeletonBase} w-20 rounded`} />
                    </div>
                    <div className={`h-4 ${skeletonBase} w-16 rounded`} />
                  </div>
                ))}
              </div>
            </div>
            <div className={`h-12 ${skeletonBase} w-full rounded-xl`} />
          </div>
        </div>
      </div>
    </div>
  );
}
