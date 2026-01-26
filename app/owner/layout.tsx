'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import OwnerSidebar from '@/components/owner/OwnerSidebar';
import MobileBottomNav from '@/components/owner/MobileBottomNav';

export default function OwnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  
  // Extract booking link from pathname if it's a specific business dashboard
  const bookingLinkMatch = pathname.match(/^\/owner\/([^\/]+)$/);
  const bookingLink = bookingLinkMatch ? bookingLinkMatch[1] : undefined;

  return (
    <div className="min-h-screen bg-white flex">
      <OwnerSidebar bookingLink={bookingLink} />
      <div className="flex-1 lg:ml-64 pb-16 lg:pb-0">
        {children}
      </div>
      <MobileBottomNav />
    </div>
  );
}
