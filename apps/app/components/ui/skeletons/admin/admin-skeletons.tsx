'use client';

import { skeletonBase } from '../base-skeleton';
import { AdminTableSkeleton } from '../common/table-skeleton';

export function OverviewSkeleton() {
  return (
    <div className="space-y-8" aria-busy="true" aria-hidden="true">
      <div>
        <div className={`h-6 ${skeletonBase} w-40 rounded`} />
        <div className={`h-4 ${skeletonBase} w-72 mt-1.5 rounded`} />
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-1">
          <div className={`h-5 ${skeletonBase} w-32 rounded`} />
          <div className={`h-4 ${skeletonBase} w-48 rounded`} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`rounded-xl border border-slate-200 p-5 ${skeletonBase}`}>
              <div className={`h-3 ${skeletonBase} w-24 rounded mb-2`} />
              <div className={`h-8 ${skeletonBase} w-16 rounded`} />
              <div className={`h-3 ${skeletonBase} w-20 rounded mt-2`} />
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-1">
          <div className={`h-5 ${skeletonBase} w-28 rounded`} />
          <div className={`h-4 ${skeletonBase} w-40 rounded`} />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className={`rounded-xl border border-slate-200 p-5 ${skeletonBase}`}>
              <div className={`h-3 ${skeletonBase} w-20 rounded mb-2`} />
              <div className={`h-8 ${skeletonBase} w-14 rounded`} />
            </div>
          ))}
        </div>
      </section>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className={`h-5 ${skeletonBase} w-40 rounded mb-4`} />
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className={`h-16 ${skeletonBase} rounded-xl`} />
          ))}
        </div>
      </section>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className={`h-5 ${skeletonBase} w-44 rounded mb-4`} />
          <div className={`h-64 ${skeletonBase} rounded-xl`} />
        </section>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className={`h-5 ${skeletonBase} w-52 rounded mb-4`} />
          <div className={`h-64 ${skeletonBase} rounded-xl`} />
        </section>
      </div>
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className={`h-5 ${skeletonBase} w-32 rounded mb-4`} />
        <div className={`h-64 ${skeletonBase} rounded-xl`} />
      </section>
    </div>
  );
}

export function AdminDashboardSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col space-y-8 pb-8" aria-busy="true">
      <OverviewSkeleton />
      <div className="flex-1 min-h-[120px]" aria-hidden="true" />
    </div>
  );
}

export function BusinessesSkeleton() {
  return (
    <div
      className="flex min-h-[calc(100vh-6rem)] flex-col pb-8"
      aria-busy="true"
      aria-hidden="true"
    >
      <div className="space-y-8">
        <div>
          <div className={`h-6 ${skeletonBase} w-28 rounded`} />
          <div className={`h-4 ${skeletonBase} w-64 mt-1.5 rounded`} />
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 space-y-1">
            <div className={`h-5 ${skeletonBase} w-36 rounded`} />
            <div className={`h-4 ${skeletonBase} w-56 rounded`} />
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="bg-slate-50 px-5 py-3.5 flex gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className={`h-3 ${skeletonBase} w-20 rounded`} />
              ))}
            </div>
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="px-5 py-4 flex gap-4 items-center">
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <div className={`h-4 ${skeletonBase} w-28 rounded`} />
                    <div className={`h-3 ${skeletonBase} w-24 rounded`} />
                  </div>
                  <div className="flex flex-col gap-1 flex-shrink-0">
                    <div className={`h-4 ${skeletonBase} w-24 rounded`} />
                    <div className={`h-3 ${skeletonBase} w-32 rounded`} />
                  </div>
                  <div className={`h-4 ${skeletonBase} w-24 rounded`} />
                  <div className={`h-4 ${skeletonBase} w-8 rounded`} />
                  <div className={`h-5 ${skeletonBase} w-14 rounded`} />
                  <div className={`h-8 ${skeletonBase} w-14 rounded`} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <div className="flex-1 min-h-[120px]" aria-hidden="true" />
    </div>
  );
}

export function UsersSkeleton() {
  return (
    <div
      className="flex min-h-[calc(100vh-6rem)] flex-col pb-8"
      aria-busy="true"
      aria-hidden="true"
    >
      <div className="space-y-8">
        <div>
          <div className={`h-6 ${skeletonBase} w-24 rounded`} />
          <div className={`h-4 ${skeletonBase} w-56 mt-1.5 rounded`} />
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 space-y-1">
            <div className={`h-5 ${skeletonBase} w-28 rounded`} />
            <div className={`h-4 ${skeletonBase} w-48 rounded`} />
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="bg-slate-50 px-5 py-3.5 flex gap-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className={`h-3 ${skeletonBase} w-16 rounded`} />
              ))}
            </div>
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="px-5 py-4 flex gap-4 items-center">
                  <div className={`h-4 ${skeletonBase} w-28 rounded flex-shrink-0`} />
                  <div className={`h-4 ${skeletonBase} w-40 rounded`} />
                  <div className={`h-5 ${skeletonBase} w-16 rounded`} />
                  <div className={`h-4 ${skeletonBase} w-8 rounded`} />
                  <div className={`h-4 ${skeletonBase} w-8 rounded`} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <div className="flex-1 min-h-[120px]" aria-hidden="true" />
    </div>
  );
}

export function BookingsSkeleton() {
  return (
    <div
      className="flex min-h-[calc(100vh-6rem)] flex-col pb-8"
      aria-busy="true"
      aria-hidden="true"
    >
      <div className="space-y-8">
        <div>
          <div className={`h-6 ${skeletonBase} w-28 rounded`} />
          <div className={`h-4 ${skeletonBase} w-72 mt-1.5 rounded`} />
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 space-y-1">
            <div className={`h-5 ${skeletonBase} w-24 rounded`} />
            <div className={`h-4 ${skeletonBase} w-52 rounded`} />
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="bg-slate-50 px-5 py-3.5 flex gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className={`h-3 ${skeletonBase} w-16 rounded`} />
              ))}
            </div>
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="px-5 py-4 flex gap-4 items-center">
                  <div className={`h-4 ${skeletonBase} w-28 rounded flex-shrink-0`} />
                  <div className={`h-4 ${skeletonBase} w-32 rounded`} />
                  <div className={`h-4 ${skeletonBase} w-24 rounded flex-shrink-0`} />
                  <div className={`h-4 ${skeletonBase} w-28 rounded`} />
                  <div className={`h-5 ${skeletonBase} w-16 rounded`} />
                  <div className={`h-8 ${skeletonBase} w-16 rounded`} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <div className="flex-1 min-h-[120px]" aria-hidden="true" />
    </div>
  );
}

export function AuditLogsSkeleton() {
  return (
    <div
      className="flex min-h-[calc(100vh-6rem)] flex-col pb-8"
      aria-busy="true"
      aria-hidden="true"
    >
      <div className="space-y-8">
        <div>
          <div className={`h-6 ${skeletonBase} w-32 rounded`} />
          <div className={`h-4 ${skeletonBase} w-64 mt-1.5 rounded`} />
        </div>
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-6 space-y-1">
            <div className={`h-5 ${skeletonBase} w-36 rounded`} />
            <div className={`h-4 ${skeletonBase} w-56 rounded`} />
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200">
            <div className="bg-slate-50 px-5 py-3.5 flex gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className={`h-3 ${skeletonBase} w-20 rounded`} />
              ))}
            </div>
            <div className="divide-y divide-slate-100">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <div key={i} className="px-5 py-4 flex gap-4 items-center">
                  <div className={`h-4 ${skeletonBase} w-32 flex-shrink-0 rounded`} />
                  <div className={`h-5 ${skeletonBase} w-24 rounded`} />
                  <div className={`h-4 ${skeletonBase} w-28 rounded`} />
                  <div className={`h-4 ${skeletonBase} flex-1 max-w-md rounded`} />
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
      <div className="flex-1 min-h-[120px]" aria-hidden="true" />
    </div>
  );
}

export function AdminAnalyticsSkeleton() {
  return (
    <div className="flex min-h-[calc(100vh-6rem)] flex-col space-y-8 pb-8" aria-busy="true">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-2">
          <div className={`h-6 ${skeletonBase} w-24 rounded`} />
          <div className={`h-4 ${skeletonBase} w-72 max-w-full rounded`} />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className={`h-10 ${skeletonBase} w-36 rounded-lg`} />
          <div className={`h-10 ${skeletonBase} w-36 rounded-lg`} />
          <div className={`h-10 ${skeletonBase} w-20 rounded-lg`} />
          <div className={`h-10 ${skeletonBase} w-24 rounded-lg`} />
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-6 shadow-sm">
        <div className={`h-4 ${skeletonBase} w-48 rounded mb-4`} />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-sm">
              <div className={`h-3 ${skeletonBase} w-20 rounded mb-2`} />
              <div className={`h-8 ${skeletonBase} w-16 rounded mt-2`} />
              <div className={`h-3 ${skeletonBase} w-28 rounded mt-2`} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-1">
          <div className={`h-5 ${skeletonBase} w-40 rounded`} />
          <div className={`h-4 ${skeletonBase} w-64 rounded`} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
          {[1, 2, 3, 4, 5, 6, 7].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className={`h-3 ${skeletonBase} w-16 rounded mb-2`} />
              <div className={`h-5 ${skeletonBase} w-12 rounded mt-1`} />
            </div>
          ))}
        </div>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5">
            <div className={`h-4 ${skeletonBase} w-28 rounded mb-4`} />
            <div className={`h-64 ${skeletonBase} rounded-lg`} />
          </div>
          <div className="rounded-xl border border-slate-100 bg-slate-50/50 p-5">
            <div className={`h-4 ${skeletonBase} w-32 rounded mb-4`} />
            <div className={`h-64 ${skeletonBase} rounded-lg`} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-1">
          <div className={`h-5 ${skeletonBase} w-32 rounded`} />
          <div className={`h-4 ${skeletonBase} w-80 max-w-full rounded`} />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-4">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
            <div key={i} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4">
              <div className={`h-3 ${skeletonBase} w-14 rounded mb-2`} />
              <div className={`h-5 ${skeletonBase} w-10 rounded mt-1`} />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-6 space-y-1">
          <div className={`h-5 ${skeletonBase} w-36 rounded`} />
          <div className={`h-4 ${skeletonBase} w-72 max-w-full rounded`} />
        </div>
        <AdminTableSkeleton rows={5} cols={7} />
      </section>

      <div className="flex-1 min-h-[120px]" aria-hidden="true" />
    </div>
  );
}
