'use client';

import { skeletonBase } from '../base-skeleton';

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

export function SelectRoleSkeleton() {
  const darkBase = 'rounded-lg bg-zinc-800/80';
  return (
    <div
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-zinc-950 p-4"
      aria-busy="true"
    >
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_70%_50%_at_50%_0%,rgba(34,197,94,0.08),transparent_55%)]"
        aria-hidden
      />
      <div className="relative w-full max-w-2xl">
        <div className={`mx-auto mb-3 h-3 w-32 ${darkBase}`} />
        <div className={`mx-auto mb-4 h-9 w-64 max-w-full ${darkBase}`} />
        <div className={`mx-auto mb-12 h-4 w-80 max-w-full ${darkBase}`} />
        <div className="grid grid-cols-1 divide-y divide-white/[0.08] border-y border-white/[0.08] sm:grid-cols-2 sm:divide-x sm:divide-y-0">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-6 py-8 sm:py-10">
              <div className={`h-10 w-10 shrink-0 ${darkBase}`} />
              <div className="min-w-0 flex-1 space-y-3">
                <div className={`h-6 w-48 max-w-full ${darkBase}`} />
                <div className={`h-4 w-full max-w-md ${darkBase}`} />
                <div className={`h-3 w-2/3 ${darkBase}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

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
