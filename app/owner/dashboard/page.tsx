'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseAuth, getUserProfile } from '@/lib/supabase/auth';
import { userService } from '@/services/user.service';
import { Salon } from '@/types';
import { formatDate } from '@/lib/utils/string';

export default function OwnerDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [businesses, setBusinesses] = useState<Salon[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (!supabaseAuth) {
        router.push('/auth/login?redirect_to=/owner/dashboard');
        return;
      }
      const { data: { session } } = await supabaseAuth.auth.getSession();
      
      if (!session?.user) {
        router.push('/auth/login?redirect_to=/owner/dashboard');
        return;
      }

      setUser(session.user);

      // Fetch user's businesses first (API will handle user type updates)
      try {
        const response = await fetch(`/api/owner/businesses`);
        if (!response.ok) {
          if (response.status === 401) {
            router.push('/auth/login?redirect_to=/owner/dashboard');
            return;
          }
          throw new Error('Failed to fetch businesses');
        }
        const result = await response.json();
        if (result.success) {
          setBusinesses(result.data || []);
          
          // If user has businesses but profile says 'customer', update it
          const profile = await getUserProfile(session.user.id);
          if (result.data && result.data.length > 0 && profile && (profile as any).user_type === 'customer') {
            // Profile will be updated by the API, but we can refresh to see the change
            window.location.reload();
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load businesses');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-8">{error}</p>
          <Link
            href="/setup"
            className="inline-block px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
          >
            Create Business
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">My Businesses</h1>
          <p className="text-gray-600">Manage all your businesses from one place</p>
        </div>

        {businesses.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No Businesses Yet</h2>
            <p className="text-gray-600 mb-8">
              Create your first business to start accepting bookings
            </p>
            <Link
              href="/setup"
              className="inline-block px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
            >
              Create Business
            </Link>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {businesses.map((business) => (
              <Link
                key={business.id}
                href={`/owner/${business.booking_link}`}
                className="bg-white rounded-lg shadow-lg p-6 hover:shadow-xl transition-shadow border-2 border-transparent hover:border-black"
              >
                <h3 className="text-xl font-semibold text-gray-900 mb-2">
                  {business.salon_name}
                </h3>
                {business.location && (
                  <p className="text-sm text-gray-500 mb-4">{business.location}</p>
                )}
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>Created {formatDate(business.created_at)}</span>
                  <span className="text-black font-medium">Manage →</span>
                </div>
              </Link>
            ))}
          </div>
        )}

        <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/setup"
            className="inline-block px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition-colors text-center"
          >
            + Add New Business
          </Link>
          <Link
            href="/categories/salon"
            className="inline-block px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-lg hover:bg-gray-200 transition-colors text-center"
          >
            Book as Customer
          </Link>
        </div>
      </div>
    </div>
  );
}

