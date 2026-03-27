'use client';

import { useSearchParams, useRouter } from 'next/navigation';
import BusinessSuccess from '@/components/setup/Succes';
import { ROUTES } from '@/lib/utils/navigation';

export default function SuccessPage() {
  const params = useSearchParams();
  const router = useRouter();

  const bookingLink = params?.get('bookingLink');
  const bookingUrl = params?.get('bookingUrl');
  const qrCode = params?.get('qrCode') || undefined;

  if (!bookingLink || !bookingUrl) {
    router.push(ROUTES.OWNER_DASHBOARD_BASE);
    return null;
  }

  return <BusinessSuccess bookingLink={bookingLink} bookingUrl={bookingUrl} qrCode={qrCode} />;
}
