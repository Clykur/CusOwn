'use client';

import Link from 'next/link';

/**
 * Mobile-only top bar: same CusOwn treatment as the landing page (PublicHeader).
 * Hidden from md and up — use in dashboard shells, not in PublicHeader’s desktop block.
 */
export function MobileBrandHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/50 bg-white/80 shadow-sm backdrop-blur-xl md:hidden">
      <div className="relative flex h-16 items-center justify-center px-4">
        <Link href="/" className="group flex items-center gap-2">
          <div className="relative">
            <span className="bg-gradient-to-r from-slate-900 via-slate-700 to-slate-900 bg-clip-text font-calegar text-2xl font-bold uppercase tracking-wide text-transparent">
              CusOwn
            </span>
            <div className="absolute -bottom-1 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-slate-900/20 to-transparent" />
          </div>
        </Link>
      </div>
    </header>
  );
}
