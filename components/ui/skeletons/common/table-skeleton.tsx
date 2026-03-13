'use client';

import { skeletonBase } from '../base-skeleton';

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

export function UsersTableBodySkeleton() {
  return (
    <>
      {[1, 2, 3, 4, 5].map((i) => (
        <tr key={i} className="animate-pulse">
          <td className="px-5 py-4">
            <div className={`h-4 ${skeletonBase} w-28 rounded`} />
          </td>
          <td className="px-5 py-4">
            <div className={`h-4 ${skeletonBase} w-40 rounded`} />
          </td>
          <td className="px-5 py-4">
            <div className={`h-5 ${skeletonBase} w-16 rounded`} />
          </td>
          <td className="px-5 py-4">
            <div className={`h-4 ${skeletonBase} w-8 rounded`} />
          </td>
          <td className="px-5 py-4">
            <div className={`h-4 ${skeletonBase} w-8 rounded`} />
          </td>
          <td className="px-5 py-4 text-right">
            <div className={`h-8 ${skeletonBase} w-16 rounded ml-auto`} />
          </td>
        </tr>
      ))}
    </>
  );
}
