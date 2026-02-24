'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseAuth } from '@/lib/supabase/auth';
import { getUserState } from '@/lib/utils/user-state';

export default function NotFound() {
  const router = useRouter();
  const pathname = usePathname();

  const [loading, setLoading] = useState(false);

  const handleGoHome = async () => {
    setLoading(true);

    try {
      const { data } = await supabaseAuth.auth.getSession();
      const userId = data?.session?.user?.id;

      // Not logged in → public home
      if (!userId) {
        router.push('/');
        return;
      }

      const state = await getUserState(userId);

      const onOwnerRoute = pathname?.startsWith('/owner');
      const onCustomerRoute = pathname?.startsWith('/customer');

      // If user has both roles
      if (state?.canAccessOwnerDashboard && state?.canAccessCustomerDashboard) {
        if (onOwnerRoute) {
          router.push('/owner/dashboard');
        } else if (onCustomerRoute) {
          router.push('/customer/dashboard');
        } else {
          // default priority
          router.push('/owner/dashboard');
        }
        return;
      }

      // Owner only
      if (state?.canAccessOwnerDashboard) {
        router.push('/owner/dashboard');
        return;
      }

      // Customer only
      if (state?.canAccessCustomerDashboard) {
        router.push('/customer/dashboard');
        return;
      }

      // Fallback
      router.push('/');
    } catch (err) {
      console.error('Navigation error:', err);
      router.push('/');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-4">404</h1>
        <p className="text-gray-600 mb-8">Page not found</p>

        <button
          onClick={handleGoHome}
          disabled={loading}
          className="inline-block bg-black text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-60"
        >
          {loading ? 'Redirecting...' : 'Go Home'}
        </button>
      </div>
    </div>
  );
}
