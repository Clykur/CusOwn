'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import ChevronRightIcon from '@/src/icons/chevron-right.svg';
import { cn } from '@/lib/utils/cn';

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
            {index > 0 && <ChevronRightIcon className="w-4 h-4 text-gray-400" aria-hidden="true" />}
            {isLast || isActive ? (
              <span className={`font-medium ${isActive ? 'text-black' : 'text-gray-600'}`}>
                {item.label}
              </span>
            ) : (
              <Link href={item.href} className="text-gray-600 hover:text-black transition-colors">
                {item.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
