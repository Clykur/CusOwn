'use client';

import Link from 'next/link';
import { ROUTES } from '@/lib/utils/navigation';
import { UI_CUSTOMER } from '@/config/constants';

/** Category config: add more entries for multi-service. No hardcoded names in layout. */
const SERVICE_CATEGORIES: { id: string; title: string; description: string; href: string }[] = [
  {
    id: 'salon',
    title: 'Salon',
    description: 'Haircuts, styling, grooming, and beauty services.',
    href: ROUTES.CUSTOMER_SALON_LIST,
  },
];

function ServiceCategoryCard({
  title,
  description,
  href,
}: {
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="group relative overflow-hidden rounded-2xl bg-white p-8 shadow-sm border border-slate-200 hover:shadow-md hover:border-slate-300 transition-all duration-200 cursor-pointer">
        <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-slate-100 group-hover:bg-slate-200 transition-colors">
          <svg
            className="h-10 w-10 text-slate-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h3 className="text-xl font-semibold text-slate-900 mb-2">{title}</h3>
        <p className="text-slate-600 leading-relaxed text-sm mb-6">{description}</p>
        <span className="inline-flex items-center gap-2 text-slate-900 font-medium text-sm group-hover:gap-3 transition-all">
          {UI_CUSTOMER.CATEGORY_CTA}
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </span>
      </div>
    </Link>
  );
}

export default function CustomerCategoriesPage() {
  const categories = SERVICE_CATEGORIES;
  const singleCategory = categories.length === 1;

  return (
    <div className="space-y-8">
      <div
        className={
          singleCategory
            ? 'flex justify-left'
            : 'grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-4xl mx-auto'
        }
      >
        {categories.map((cat) => (
          <ServiceCategoryCard
            key={cat.id}
            title={cat.title}
            description={cat.description}
            href={cat.href}
          />
        ))}
      </div>
    </div>
  );
}
