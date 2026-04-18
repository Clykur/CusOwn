import type { Metadata, Viewport } from 'next';
import { Inter, Space_Grotesk } from 'next/font/google';
import Script from 'next/script';
import { Suspense } from 'react';
import { AnalyticsClient } from '@/components/analytics-client';
import { PerformanceMonitor } from '@/components/performance-monitor';
import { AuthFlowDebug } from '@/components/auth/auth-flow-debug';
import { publicEnv } from '@/config/env.public';
import './globals.css';
import '@/lib/init/events';

const isDev = publicEnv.nodeEnv === 'development';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });
const spaceGrotesk = Space_Grotesk({ subsets: ['latin'], variable: '--font-space-grotesk' });

export const metadata: Metadata = {
  title: 'CusOwn - Appointment Management for Service Businesses',
  description:
    'A modern appointment and slot management platform for service businesses. Simple, reliable, and built to scale.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

/** Segment config must be a static literal (no conditional). Use force-dynamic so auth/chunk URLs work in dev and prod. */
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth" suppressHydrationWarning>
      <head />
      <body className={`${inter.variable} ${spaceGrotesk.variable} font-sans antialiased`}>
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
        <PerformanceMonitor enableDevTools={isDev} sampleRate={isDev ? 1.0 : 0.1} />
      </body>
    </html>
  );
}
