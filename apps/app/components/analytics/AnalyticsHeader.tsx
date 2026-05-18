'use client';

import { ReactNode } from 'react';

/** Sticky strip for analytics: optional summary + filters (no inner card shell). */
export default function AnalyticsHeader({
  summary,
  children,
}: {
  summary?: string;
  children: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-0 border-b border-slate-200/80 bg-white/80 px-0 pb-3 pt-2 backdrop-blur-md sm:-mx-1 sm:px-1">
      {summary ? (
        <div className="mb-3 flex items-center justify-end gap-2 px-0 sm:px-1">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
            {summary}
          </span>
        </div>
      ) : null}
      <div className="px-0 sm:px-1">{children}</div>
    </div>
  );
}
