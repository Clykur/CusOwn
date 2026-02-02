'use client';

import React from 'react';
import CustomerSidebar from '@/components/customer/customer-sidebar';
import CustomerMobileBottomNav from '@/components/customer/mobile-bottom-nav';

export default function CustomerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerSidebar />
      <main className="lg:pl-64 pb-16 lg:pb-0">
        {children}
      </main>
      <CustomerMobileBottomNav />
    </div>
  );
}
