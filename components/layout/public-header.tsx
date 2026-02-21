'use client';

import Link from 'next/link';
import AuthButton from '@/components/auth/auth-button';

/**
 * Header for public routes (landing, auth). No session fetch; Sign In only.
 */
export function PublicHeader() {
  return (
    <>
      <header className="h-14 flex items-center justify-center md:justify-between px-4 border-b bg-white md:hidden">
        <h1 className="text-xl md:text-2xl font-calegar font-semibold tracking-tight hover:opacity-80 transition-opacity uppercase">
          CUSOWN
        </h1>
      </header>
      <header className="hidden md:block border-b border-gray-200 bg-white sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center hover:opacity-80 transition-opacity">
              <span className="text-xl md:text-2xl font-calegar font-semibold tracking-tight hover:opacity-80 transition-opacity uppercase">
                CusOwn
              </span>
            </Link>
            <nav className="flex items-center gap-4">
              <AuthButton />
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}
