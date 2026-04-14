'use client';

import { CUSTOMER_SCREEN_TITLE_CLASSNAME } from '@/config/constants';
import { cn } from '@/lib/utils/cn';

export default function CustomerHeader({
  title,
  subtitle,
  className,
}: {
  title?: string;
  subtitle?: string;
  /** Optional; use e.g. `mb-2 md:mb-8` to tighten space above page content on mobile. */
  className?: string;
}) {
  return (
    <div className={cn('mb-8 flex flex-wrap items-start justify-between gap-4', className)}>
      <div>
        {title && <h1 className={CUSTOMER_SCREEN_TITLE_CLASSNAME}>{title}</h1>}
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
    </div>
  );
}
