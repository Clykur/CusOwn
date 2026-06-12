'use client';

import { useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { supabaseAuth } from '@cusown/shared';
import { fetchUserState } from '@cusown/shared';

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

      const state = await fetchUserState();

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
    <div className="min-h-screen bg-background-primary flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-zinc-900/40 border border-white/10 rounded-2xl shadow-2xl p-8 text-center">
        <h1 className="text-4xl font-bold text-white mb-4">404</h1>
        <p className="text-zinc-400 mb-8">Page not found</p>

        <button
          onClick={handleGoHome}
          disabled={loading}
          className="inline-block bg-brand-primary text-black font-semibold py-3 px-6 rounded-lg hover:bg-brand-primaryHover transition-colors disabled:opacity-60"
        >
          {loading ? 'Redirecting...' : 'Go Home'}
        </button>
      </div>
    </div>
  );
}
