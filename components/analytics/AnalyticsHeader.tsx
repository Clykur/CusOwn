'use client';

import { motion } from 'framer-motion';
import { ReactNode } from 'react';

export default function AnalyticsHeader({
  summary,
  refreshing,
  children,
}: {
  summary?: string;
  refreshing?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="sticky top-0 z-20 -mx-1 border-b border-slate-200/80 bg-white/80 px-1 pb-4 pt-3 backdrop-blur-md">
      <div className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex items-center justify-end gap-2">
          <div className="flex items-center gap-2">
            {summary ? (
              <span className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
                {summary}
              </span>
            ) : null}
            {refreshing ? (
              <motion.span
                initial={{ opacity: 0.4 }}
                animate={{ opacity: 1 }}
                transition={{ repeat: Infinity, repeatType: 'reverse', duration: 0.8 }}
                className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600"
              >
                Refreshing
              </motion.span>
            ) : null}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
