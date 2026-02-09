'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import OwnerSidebar from '@/components/owner/owner-sidebar';
import MobileBottomNav from '@/components/owner/mobile-bottom-nav';

export default function OwnerLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  // Extract booking link from pathname if it's a specific business dashboard
  const bookingLinkMatch = pathname.match(/^\/owner\/([^\/]+)$/);
  const bookingLink = bookingLinkMatch ? bookingLinkMatch[1] : undefined;

  return (
    <div className="min-h-screen bg-white flex">
      <OwnerSidebar />
      <div className="flex-1 lg:ml-64 pb-16 lg:pb-0">{children}</div>
      <MobileBottomNav />
    </div>
  );
}
