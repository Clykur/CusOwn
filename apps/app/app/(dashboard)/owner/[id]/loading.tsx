'use client';

import { useParams } from 'next/navigation';
import Breadcrumb from '@/components/ui/breadcrumb';
import { OwnerSalonDetailLoadingBody } from '@/components/ui/skeleton';

export default function OwnerSalonDetailLoading() {
  const params = useParams();
  const routeId = typeof params?.id === 'string' ? params.id : '';

  return (
    <div className="flex w-full flex-col gap-5 pb-24 max-md:pb-28 md:gap-6">
      <Breadcrumb
        className="max-md:mb-4 max-md:text-xs max-md:[&_svg]:h-3.5 max-md:[&_svg]:w-3.5"
        items={[
          { label: 'Businesses', href: '/owner/businesses' },
          { label: 'Loading...', href: routeId ? `/owner/${routeId}` : '/owner/businesses' },
        ]}
      />
      <OwnerSalonDetailLoadingBody />
    </div>
  );
}
