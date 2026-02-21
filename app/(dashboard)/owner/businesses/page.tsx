'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { OwnerBusinessesSkeleton } from '@/components/ui/skeleton';
import { Toast } from '@/components/ui/toast';
import { ROUTES } from '@/lib/utils/navigation';
import { formatDate } from '@/lib/utils/string';
import { Salon } from '@/types';

export default function OwnerBusinessesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [businesses, setBusinesses] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    const deleted = searchParams.get('deleted');
    if (deleted === '1') {
      setToastMessage('Business deleted successfully');
      router.replace('/owner/businesses', { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    const run = async () => {
      try {
        const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
        const sessionJson = await sessionRes.json();
        if (!sessionRes.ok || !sessionJson?.data?.user) {
          router.replace(ROUTES.AUTH_LOGIN('/owner/businesses'));
          return;
        }

        const res = await fetch('/api/owner/businesses', { credentials: 'include' });
        const json = await res.json();
        setBusinesses(json.data || []);
      } finally {
        setLoading(false);
      }
    };

    run();
  }, [router]);

  if (loading) return <OwnerBusinessesSkeleton />;

  return (
    <div className="w-full pb-24 flex flex-col gap-6">
      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {businesses.map((b) => (
          <Link
            key={b.id}
            href={`/owner/${b.booking_link}`}
            className="bg-white border border-slate-200 rounded-lg p-6 hover:border-slate-400 transition"
          >
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{b.salon_name}</h2>

                {b.location && (
                  <p className="flex items-center text-gray-600 mt-2 text-sm">
                    <svg
                      className="w-4 h-4 mr-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                    </svg>
                    {b.location}
                  </p>
                )}
              </div>

              <span className="text-gray-400 text-xl">›</span>
            </div>

            <div className="border-t mt-6 pt-4 flex items-center justify-between">
              <span className="text-sm text-gray-500">Created {formatDate(b.created_at)}</span>
              <span className="font-semibold text-black">Manage</span>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
