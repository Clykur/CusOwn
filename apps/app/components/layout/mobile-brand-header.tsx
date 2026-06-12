'use client';

import { useLogoNavigation } from '@cusown/shared/client';

/**
 * Mobile + tablet top bar: sticky CusOwn branding shown below `lg` (< 1024px).
 * Hidden from lg and up where the desktop sidebar shows the brand instead.
 * Uses `justify-between` layout so the title aligns with content-area padding
 * (`px-4 sm:px-6`) on all breakpoints, preventing the visual off-center shift
 * that occurred when the centred title sat above left-aligned page content.
 */
export function MobileBrandHeader() {
  const { handleLogoClick } = useLogoNavigation();

  return (
    <header className="sticky top-0 z-50 border-b border-border-primary bg-[#181818]/95 shadow-sm backdrop-blur-xl lg:hidden">
      <div className="relative flex h-14 items-center justify-center px-4 sm:px-6">
        <button onClick={handleLogoClick} className="absolute left-1/2 -translate-x-1/2 transform">
          <div className="relative">
            <span className="bg-gradient-to-r from-white via-white to-brand-primary bg-clip-text font-calegar text-xl font-bold uppercase tracking-wide text-transparent sm:text-2xl">
              CusOwn
            </span>
          </div>
        </button>
      </div>
    </header>
  );
}
