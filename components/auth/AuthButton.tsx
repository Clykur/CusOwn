'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseAuth, signOut, getUserProfile, isAdmin } from '@/lib/supabase/auth';
import type { User } from '@supabase/supabase-js';

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
    router.push('/');
  };

  if (loading) {
    return (
      <div className="h-10 w-20 bg-gray-200 animate-pulse rounded-lg"></div>
    );
  }

  const handleAdminClick = async (e: React.MouseEvent) => {
    e.preventDefault();
    
    if (!user) {
      router.push('/auth/login?redirect_to=/admin/dashboard');
      return;
    }

    // Double-check admin status before navigating
    const adminCheck = await isAdmin(user.id);
    if (!adminCheck) {
      alert('You are not an admin user. Please contact support if you believe this is an error.');
      return;
    }

    router.push('/admin/dashboard');
  };

  if (!user) {
    return (
      <button
        onClick={handleAdminClick}
        className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
      >
        Admin
      </button>
    );
  }

  // Show one clear CTA button based on user type
  if (userType === 'owner') {
    return (
      <div className="flex items-center gap-3">
        {isAdminUser && (
          <button
            onClick={handleAdminClick}
            className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
          >
            Admin
          </button>
        )}
        <button
          onClick={() => router.push('/owner/dashboard')}
          className="px-6 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
        >
          Owner Dashboard
        </button>
        <button
          onClick={handleSignOut}
          className="px-3 py-2 text-gray-600 hover:text-gray-900 text-sm"
        >
          Sign Out
        </button>
      </div>
    );
  }

  // Customer CTA - show bookings or browse
  return (
    <div className="flex items-center gap-3">
      {isAdminUser && (
        <button
          onClick={handleAdminClick}
          className="px-4 py-2 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition-colors"
        >
          Admin
        </button>
      )}
      <button
        onClick={() => router.push('/categories/salon')}
        className="px-6 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
      >
        Book Appointment
      </button>
      <button
        onClick={handleSignOut}
        className="px-3 py-2 text-gray-600 hover:text-gray-900 text-sm"
      >
        Sign Out
      </button>
    </div>
  );
}

