'use client';

import type { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import ChevronLeftIcon from '@/src/icons/chevron-left.svg';
import { OWNER_SCREEN_TITLE_CLASSNAME } from '@/config/constants';
import { cn } from '@/lib/utils/cn';

export default function OwnerHeader({
  title,
  subtitle,
  trailing,
}: {
  title?: string;
  subtitle?: string;
  /** Shown on the right of the title row on small screens only (e.g. analytics toolbar). */
  trailing?: ReactNode;
}) {
  const router = useRouter();
  const showAddButton = title === 'My Businesses';
  const showBackButton = title === 'Create Business';

  const hasTrailing = Boolean(trailing);
  const subtitleClass = 'text-sm leading-snug text-gray-600 md:text-base';

  return (
    <div className="mb-6 md:mb-8">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 flex-1 items-start gap-2 sm:gap-3">
          {showBackButton && (
            <button
              onClick={() => router.push('/owner/businesses')}
              className="mt-0.5 shrink-0 text-gray-700 hover:text-black lg:hidden"
              aria-label="Back"
            >
              <ChevronLeftIcon className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden="true" />
            </button>
          )}

          <div className="min-w-0">
            {title && <h1 className={cn(OWNER_SCREEN_TITLE_CLASSNAME, 'mb-1 md:mb-2')}>{title}</h1>}
            {subtitle ? (
              <p className={cn(subtitleClass, hasTrailing && 'hidden md:block')}>{subtitle}</p>
            ) : null}
          </div>
        </div>

        <div className="flex shrink-0 items-start gap-2">
          {hasTrailing ? <div className="pt-0.5 md:hidden">{trailing}</div> : null}
          {showAddButton ? (
            <button
              type="button"
              onClick={() => router.push('/owner/setup')}
              className={cn(
                'shrink-0 rounded-xl bg-slate-900 font-semibold text-white shadow-sm transition hover:bg-slate-800 active:bg-slate-950',
                hasTrailing
                  ? 'hidden px-4 py-2 text-sm md:flex md:rounded-lg'
                  : 'px-3 py-1.5 text-xs md:rounded-lg md:px-4 md:py-2 md:text-sm'
              )}
            >
              + Add Business
            </button>
          ) : null}
        </div>
      </div>
      {hasTrailing && subtitle ? (
        <p className={cn('mt-2 md:hidden', subtitleClass)}>{subtitle}</p>
      ) : null}
    </div>
  );
}
