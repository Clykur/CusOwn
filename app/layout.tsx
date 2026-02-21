import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import Script from 'next/script';
import { Suspense } from 'react';
import { AnalyticsClient } from '@/components/analytics-client';
import { AuthFlowDebug } from '@/components/auth/auth-flow-debug';
import './globals.css';
import '@/lib/init/events';

const isDev = process.env.NODE_ENV === 'development';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CusOwn - Appointment Management for Service Businesses',
  description:
    'A modern appointment and slot management platform for service businesses. Simple, reliable, and built to scale.',
};

/** Segment config must be a static literal (no conditional). Use force-dynamic so auth/chunk URLs work in dev and prod. */
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Script
          id="supabase-auth-safe"
          src="/scripts/supabase-auth-safe.js"
          strategy="beforeInteractive"
        />
        {isDev && (
          <Suspense fallback={null}>
            <AuthFlowDebug />
          </Suspense>
        )}
        {children}
        <AnalyticsClient />
      </body>
    </html>
  );
}
