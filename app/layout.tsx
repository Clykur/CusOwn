import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { Analytics } from '@vercel/analytics/next';
import './globals.css';
import Header from '@/components/layout/header';
import UniversalSidebar from '@/components/layout/universal-sidebar';
import '@/lib/init/events';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'CusOwn - Appointment Management for Service Businesses',
  description:
    'A modern appointment and slot management platform for service businesses. Simple, reliable, and built to scale.',
  // Next.js will automatically detect icon.svg in the app directory
  // No need to specify it in metadata
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <UniversalSidebar />
        <Header />
        {children}
        <Analytics />
      </body>
    </html>
  );
}
