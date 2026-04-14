'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { OwnerBusinessesSkeleton } from '@/components/ui/skeleton';
import { Toast } from '@/components/ui/toast';
import { ROUTES } from '@/lib/utils/navigation';
import { formatDate } from '@/lib/utils/string';
import { Salon } from '@/types';
import { getCachedSession } from '@/lib/utils/session-cache';
import MapPinIcon from '@/src/icons/map-pin.svg';

export default function OwnerBusinessesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [businesses, setBusinesses] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const deleted = searchParams?.get('deleted');
    if (deleted === '1') {
      setToastMessage('Business deleted successfully');
      router.replace('/owner/businesses', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    const run = async () => {
      try {
        const [user, businessesRes] = await Promise.all([
          getCachedSession(),
          fetch('/api/owner/businesses', { credentials: 'include' }),
        ]);

        if (!user) {
          router.replace(ROUTES.AUTH_LOGIN('/owner/businesses'));
          return;
        }

        const json = await businessesRes.json();
        setBusinesses(json.data || []);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [router]);

  if (loading) return <OwnerBusinessesSkeleton />;

  return (
    <div className="flex w-full flex-col gap-4 pb-24 md:gap-6">
      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 md:gap-6">
        {businesses.map((b) => (
          <Link
            key={b.id}
            href={`/owner/${b.booking_link}`}
            className="rounded-xl border border-slate-200/90 bg-white p-4 transition hover:border-slate-300 hover:bg-slate-50/50 active:bg-slate-50 md:rounded-lg md:p-6"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-semibold leading-snug text-gray-900 md:text-lg">
                  {b.salon_name}
                </h2>

                {b.location && (
                  <p className="mt-1.5 flex items-center gap-1 text-xs text-gray-600 md:mt-2 md:text-sm">
                    <MapPinIcon className="h-3.5 w-3.5 shrink-0 md:h-4 md:w-4" aria-hidden="true" />
                    <span className="min-w-0 truncate">{b.location}</span>
                  </p>
                )}
              </div>

              <span
                className="shrink-0 text-lg leading-none text-slate-400 md:text-xl"
                aria-hidden="true"
              >
                ›
              </span>
            </div>

            <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3 md:mt-6 md:pt-4">
              <span className="text-xs text-gray-500 md:text-sm">
                Created {formatDate(b.created_at)}
              </span>
              <span className="text-xs font-semibold text-slate-900 md:text-sm">Manage</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
