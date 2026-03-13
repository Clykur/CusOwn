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
