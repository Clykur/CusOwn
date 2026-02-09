'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseAuth } from '@/lib/supabase/auth';
import { getOwnerDashboardUrl } from '@/lib/utils/navigation';
import { formatDate } from '@/lib/utils/string';
import { Salon } from '@/types';

export default function OwnerBusinessesPage() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabaseAuth.auth.getSession();
      if (!data.session) {
        router.replace('/login');
        return;
      }

      const res = await fetch('/api/owner/businesses', {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      });

      const json = await res.json();
      setBusinesses(json.data || []);
      setLoading(false);
    };

    run();
  }, [router]);

  if (loading) return null;

  return (
    <div className="max-w-5xl mx-auto px-4 py-10">
      {/* Header */}
      <h1 className="text-2xl font-bold mb-8">My Businesses</h1>

      {/* Business Cards */}
      <div className="grid gap-6">
        {businesses.map((b) => (
          <Link
            key={b.id}
            href={getOwnerDashboardUrl(b.booking_link)}
            className="bg-white border border-gray-200 rounded-xl p-6 hover:border-black transition"
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
              <span className="font-semibold text-black">Manage →</span>
            </div>
          </Link>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="flex gap-4 mt-10">
        <Link
          href="/setup"
          className="flex items-center gap-2 bg-black text-white px-6 h-11 rounded-lg font-semibold hover:bg-gray-900"
        >
          <span className="text-lg">＋</span>
          Add New Business
        </Link>

        <Link
          href="/categories/salon"
          className="flex items-center gap-2 bg-gray-200 text-gray-800 px-6 h-11 rounded-lg font-semibold hover:bg-gray-300"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2"
            />
          </svg>
          Book as Customer
        </Link>
      </div>
    </div>
  );
}
