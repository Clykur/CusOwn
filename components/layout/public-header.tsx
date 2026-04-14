'use client';

import Link from 'next/link';
import AuthButton from '@/components/auth/auth-button';
import { MobileBrandHeader } from '@/components/layout/mobile-brand-header';

/**
 * Header for public routes (landing, auth). No session fetch; Sign In only.
 */
export function PublicHeader() {
  return (
    <>
      <MobileBrandHeader />

      {/* Desktop Header */}
      <header className="hidden md:block sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link href="/" className="flex items-center group">
              <span className="text-2xl font-calegar font-bold tracking-wide bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent uppercase group-hover:from-slate-700 group-hover:via-slate-500 group-hover:to-slate-700 transition-all duration-300">
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
