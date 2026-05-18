'use client';

import dynamic from 'next/dynamic';

/**
 * Load Vercel Analytics only on the client to avoid server bundle resolving
 * vendor-chunks/@vercel.js (Next 15 webpack can fail with "Cannot find module").
 */
const Analytics = dynamic(() => import('@vercel/analytics/next').then((mod) => mod.Analytics), {
  ssr: false,
});

export function AnalyticsClient() {
  return process.env.NODE_ENV === 'production' ? <Analytics /> : null;
}
