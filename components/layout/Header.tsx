'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import AuthButton from '@/components/auth/auth-button';

export default function Header() {
  const pathname = usePathname();
  
  // Don't show header on pages with sidebars (all authenticated pages now have sidebars)
  // Only show on public pages: home, booking link pages, auth pages, select-role
  if (pathname?.startsWith('/admin') || 
      pathname?.startsWith('/customer') || 
      pathname?.startsWith('/owner') ||
      pathname?.startsWith('/booking/') ||
      pathname?.startsWith('/categories') ||
      pathname?.startsWith('/salon/') ||
      pathname === '/setup' ||
      pathname === '/profile') {
    return null;
  }

  return (
    <header className="border-b border-gray-200 bg-white sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
            <span className="text-2xl font-bold text-black">CusOwn</span>
          </Link>
          
          <nav className="flex items-center gap-4">
            <AuthButton />
          </nav>
        </div>
      </div>
    </header>
  );
}

