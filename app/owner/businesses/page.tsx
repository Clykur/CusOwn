'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseAuth } from '@/lib/supabase/auth';
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
    <div className="w-full px-4 pt-2 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <h1 className="text-2xl sm:text-3xl font-bold mb-6">My Businesses</h1>

      {/* Business Cards */}
      <div className="grid gap-6">
        {businesses.map((b) => (
          <Link
            key={b.id}
            href={`/owner/${b.booking_link}`}
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
    </div>
  );
}
