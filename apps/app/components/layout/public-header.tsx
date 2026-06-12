'use client';

import AuthButton from '@/components/auth/auth-button';
import { MobileBrandHeader } from '@/components/layout/mobile-brand-header';
import { useLogoNavigation } from '@cusown/shared/client';

/**
 * Header for public routes (landing, auth). No session fetch; Sign In only.
 */
export function PublicHeader() {
  const { handleLogoClick } = useLogoNavigation();

  return (
    <>
      <MobileBrandHeader />

      {/* Desktop Header */}
      <header className="sticky top-0 z-50 hidden border-b border-border-secondary bg-background-primary/95 backdrop-blur-xl lg:block">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <button onClick={handleLogoClick} className="group flex items-center">
              <div
                className={`font-display font-bold tracking-tight text-white transition-[font-size] duration-200`}
              >
                CUSOWN
              </div>
            </button>

            <nav className="flex items-center gap-4">
              <AuthButton />
            </nav>
          </div>
        </div>
      </header>
    </>
  );
}
