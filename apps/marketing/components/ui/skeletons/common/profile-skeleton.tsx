'use client';

import { skeletonBase } from '../base-skeleton';

export function ProfileSkeleton() {
  return (
    <div className="min-h-screen bg-white flex" aria-busy="true">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-8">
            <div className={`h-6 ${skeletonBase} w-24 rounded`} />
            <div className={`h-4 ${skeletonBase} w-56 rounded mt-1`} />
          </div>

          <div className="space-y-8">
            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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
                    <div className={`h-10 ${skeletonBase} w-full rounded-lg mt-1`} />
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
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

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="flex justify-between items-center mb-6">
                <div>
                  <div className={`h-5 ${skeletonBase} w-36 rounded`} />
                  <div className={`h-4 ${skeletonBase} w-44 rounded mt-1`} />
                </div>
                <div className={`h-10 ${skeletonBase} w-28 rounded-lg`} />
              </div>
              <div className="overflow-hidden rounded-xl border border-slate-200">
                <div className="bg-slate-50 px-5 py-3.5 flex gap-4 border-b border-slate-200">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className={`h-4 ${skeletonBase} flex-1 rounded`} />
                  ))}
                </div>
                {[1, 2, 3, 4].map((i) => (
                  <div
                    key={i}
                    className="px-5 py-4 flex gap-4 border-b border-slate-100 last:border-0"
                  >
                    {[1, 2, 3, 4].map((j) => (
                      <div key={j} className={`h-4 ${skeletonBase} flex-1 rounded`} />
                    ))}
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className={`h-5 ${skeletonBase} w-32 rounded mb-1`} />
              <div className={`h-4 ${skeletonBase} w-48 rounded mb-6`} />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-5">
                    <div className={`h-5 ${skeletonBase} w-36 rounded`} />
                    <div className={`h-4 ${skeletonBase} w-28 rounded mt-2`} />
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
