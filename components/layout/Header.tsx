'use client';

import Link from 'next/link';
import AuthButton from '@/components/auth/AuthButton';

export default function Header() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center">
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

