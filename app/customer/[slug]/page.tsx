'use client';

import dynamic from 'next/dynamic';
import { BusinessProfileSkeleton } from '@/components/ui/skeleton';

const BusinessProfile = dynamic(() => import('@/components/salon/BusinessProfile'), {
  loading: () => <BusinessProfileSkeleton />,
});

export default function BusinessViewPage() {
  return <BusinessProfile />;
}
