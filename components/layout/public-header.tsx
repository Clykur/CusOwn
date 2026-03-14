'use client';

import Link from 'next/link';
import AuthButton from '@/components/auth/auth-button';

/**
 * Header for public routes (landing, auth). No session fetch; Sign In only.
 */
export function PublicHeader() {
  return (
    <>
      {/* Mobile Header - Premium centered design */}
      <header className="md:hidden sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-slate-200/50 shadow-sm">
        <div className="h-16 flex items-center justify-center px-4 relative">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="relative">
              <span className="text-2xl font-calegar font-bold tracking-wide bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text text-transparent uppercase">
                CusOwn
              </span>
              <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-slate-900/20 to-transparent" />
            </div>
          </Link>
        </div>
      </header>

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
