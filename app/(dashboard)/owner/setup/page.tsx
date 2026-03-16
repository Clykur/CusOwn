'use client';

import { useEffect, useState } from 'react';
import CreateBusinessForm from '@/components/setup/create-business-form';
import { OwnerSetupSkeleton } from '@/components/ui/skeleton';
import { ROUTES } from '@/lib/utils/navigation';
import Breadcrumb from '@/components/ui/breadcrumb';

const SKELETON_MIN_DISPLAY_MS = 400;

/**
 * Create business page under owner layout. Sidebar stays visible; styling matches owner dashboard and admin.
 */
export default function OwnerSetupPage() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setLoading(false), SKELETON_MIN_DISPLAY_MS);
    return () => clearTimeout(t);
  }, []);

  if (loading) return <OwnerSetupSkeleton />;

  return (
    <div className="w-full pb-24">
      <Breadcrumb
        items={[
          { label: 'Businesses', href: '/owner/businesses' },
          { label: 'Create Business', href: '/owner/setup' },
        ]}
      />
      <CreateBusinessForm
        redirectAfterSuccess={ROUTES.OWNER_DASHBOARD_BASE}
        showOnboardingProgress={false}
        embedded
      />
    </div>
  );
}
