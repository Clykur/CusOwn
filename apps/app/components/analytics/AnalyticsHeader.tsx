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
    <div className="sticky top-0 z-20 -mx-0 border-b border-border-primary bg-surface-card/80 px-0 pb-3 pt-2 backdrop-blur-md sm:-mx-1 sm:px-1">
      {summary ? (
        <div className="mb-3 flex items-center justify-end gap-2 px-0 sm:px-1">
          <span className="rounded-md border border-border-primary bg-surface-elevated px-2.5 py-1 text-xs font-medium text-text-secondary">
            {summary}
          </span>
        </div>
      ) : null}
      <div className="px-0 sm:px-1">{children}</div>
    </div>
  );
}
