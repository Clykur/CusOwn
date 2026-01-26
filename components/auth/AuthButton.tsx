'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseAuth, signOut, getUserProfile, isAdmin } from '@/lib/supabase/auth';
import type { User } from '@supabase/supabase-js';
import { ROUTES } from '@/lib/utils/navigation';

// Check if Supabase is configured
const isSupabaseConfigured = () => {
  try {
    return supabaseAuth !== null;
  } catch {
    return false;
  }
};

export default function AuthButton() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [userType, setUserType] = useState<'owner' | 'customer' | null>(null);
  const [isAdminUser, setIsAdminUser] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabaseAuth) {
      setLoading(false);
      return;
    }

        // Get initial session with error handling
        supabaseAuth!.auth.getSession()
          .then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            if (session?.user) {
              loadUserProfile(session.user.id);
            } else {
              setLoading(false);
            }
          })
          .catch((error) => {
            console.error('Failed to get session:', error);
            setLoading(false);
          });

        // Listen for auth changes
        try {
          const {
            data: { subscription },
          } = supabaseAuth!.auth.onAuthStateChange((_event, session) => {
        setUser(session?.user ?? null);
        if (session?.user) {
          loadUserProfile(session.user.id);
        } else {
          setUserType(null);
          setLoading(false);
        }
      });

      return () => {
        if (subscription) {
          subscription.unsubscribe();
        }
      };
    } catch (error) {
      console.error('Failed to set up auth listener:', error);
      setLoading(false);
      return;
    }
  }, []);

      const loadUserProfile = async (userId: string) => {
        try {
            const profile = await getUserProfile(userId);
            if (profile) {
              // Keep admin type separate for UI
              const userType = (profile as any).user_type;
              setUserType(userType === 'both' ? 'owner' : userType);
              // Check if user is admin
              const adminCheck = await isAdmin(userId);
              setIsAdminUser(adminCheck);
            } else {
            // Only check businesses if we have a session token
            // This prevents 401 errors when user isn't fully authenticated
            try {
              if (!supabaseAuth) {
                setLoading(false);
                return;
              }
              const { data: { session } } = await supabaseAuth.auth.getSession();
              if (session?.access_token) {
                const response = await fetch('/api/owner/businesses', {
                  headers: {
                    'Authorization': `Bearer ${session.access_token}`,
                  },
                });
                if (response.ok) {
                  const result = await response.json();
                  if (result.success && result.data && result.data.length > 0) {
                    setUserType('owner'); // Show dashboard button if they have businesses
                  }
                }
              }
            } catch {
              // Ignore errors - user might not be authenticated yet
            }
          }
        } catch (error) {
          // Silently handle errors - user might not have profile yet
        } finally {
          setLoading(false);
        }
      };

  const handleSignOut = async () => {
    await signOut();
    router.push(ROUTES.HOME);
  };

  if (loading) {
    return (
      <div className="h-10 w-20 bg-gray-200 animate-pulse rounded-lg"></div>
    );
  }

  if (!user) {
    return (
      <Link href={ROUTES.AUTH_LOGIN()}>
        <button className="px-6 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors">
          Sign In
        </button>
      </Link>
    );
  }

  // Show clear navigation based on user type - NO admin buttons in regular header
  if (userType === 'owner') {
    return (
      <div className="flex items-center gap-3">
        <button
          onClick={() => router.push(ROUTES.OWNER_DASHBOARD_BASE)}
          className="px-6 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
        >
          My Dashboard
        </button>
        <button
          onClick={handleSignOut}
          className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
        >
          Sign Out
        </button>
      </div>
    );
  }

  // Customer navigation
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => router.push(ROUTES.CUSTOMER_DASHBOARD)}
        className="px-6 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
      >
        My Bookings
      </button>
      <button
        onClick={() => router.push(ROUTES.SALON_LIST)}
        className="px-6 py-2 bg-white border-2 border-gray-300 text-gray-700 font-semibold rounded-lg hover:bg-gray-50 transition-colors"
      >
        Book Appointment
      </button>
      <button
        onClick={handleSignOut}
        className="px-4 py-2 text-gray-600 hover:text-gray-900 text-sm font-medium"
      >
        Sign Out
      </button>
    </div>
  );
}

