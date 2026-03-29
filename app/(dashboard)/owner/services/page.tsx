'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function OwnerServicesPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/owner/businesses');
  }, [router]);

  return null;
}
