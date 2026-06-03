'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ChevronRightIcon from '@cusown/shared/icons/chevron-right.svg';
import { cn } from '@cusown/shared';

interface BreadcrumbItem {
  label: string;
  href: string;
}

interface BreadcrumbProps {
  items: BreadcrumbItem[];
  className?: string;
}

export default function Breadcrumb({ items, className }: BreadcrumbProps) {
  const pathname = usePathname();

  return (
    <nav
      className={cn('mb-6 hidden items-center gap-2 text-sm md:flex', className)}
      aria-label="Breadcrumb"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isActive = pathname === item.href;

        return (
          <div key={item.href} className="flex items-center gap-2">
            {index > 0 && (
              <ChevronRightIcon className="h-4 w-4 text-text-secondary" aria-hidden="true" />
            )}
            {isLast || isActive ? (
              <span
                className={cn(
                  'font-medium',
                  isActive ? 'text-text-primary' : 'text-text-secondary'
                )}
              >
                {' '}
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-text-secondary transition-colors hover:text-text-primary"
              >
                {' '}
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
