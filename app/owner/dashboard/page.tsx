'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseAuth } from '@/lib/supabase/auth';
import { ROUTES } from '@/lib/utils/navigation';
import { OwnerDashboardSkeleton } from '@/components/ui/skeleton';

interface DashboardStats {
  totalBusinesses: number;
  totalBookings: number;
  confirmedBookings: number;
  pendingBookings: number;
  cancelledBookings: number;
}

export default function OwnerDashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats | null>(null);

  useEffect(() => {
    const run = async () => {
      const { data } = await supabaseAuth.auth.getSession();
      if (!data.session) {
        router.replace(ROUTES.AUTH_LOGIN('/owner/dashboard'));
        return;
      }

      const res = await fetch('/api/owner/dashboard-stats', {
        headers: {
          Authorization: `Bearer ${data.session.access_token}`,
        },
      });

      if (!res.ok) {
        router.replace('/owner/businesses');
        return;
      }

      const json = await res.json();
      setStats(json.data);
      setLoading(false);
    };

    run();
  }, [router]);

  if (loading) return <OwnerDashboardSkeleton />;

  return (
    <div className="mx-auto max-w-7xl px-4 pt-2 pb-20 sm:p-6 lg:pt-6">
      {/* <h1 className="text-2xl font-bold mb-8">Owner Dashboard</h1> */}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <Stat label="Total Businesses" value={stats!.totalBusinesses} />
        <Stat label="Total Bookings" value={stats!.totalBookings} />
        <Stat label="Confirmed" value={stats!.confirmedBookings} />
        <Stat label="Pending" value={stats!.pendingBookings} />
      </div>

      <Link
        href="/owner/businesses"
        className="inline-block px-5 py-3 bg-black text-white rounded-lg"
      >
        View My Businesses →
      </Link>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white border rounded-lg p-6">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-bold">{value}</div>
    </div>
  );
}
