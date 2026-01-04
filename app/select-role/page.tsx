'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { supabaseAuth, isAdmin } from '@/lib/supabase/auth';
import { userService } from '@/services/user.service';

function SelectRoleContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [selectedRole, setSelectedRole] = useState<'owner' | 'customer' | null>(
    (searchParams.get('role') as 'owner' | 'customer') || null
  );
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is already logged in
    if (!supabaseAuth) {
      setLoading(false);
      return;
    }
    supabaseAuth.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user);
        // Check if user is admin - redirect directly to admin dashboard
        const adminCheck = await isAdmin(session.user.id);
        if (adminCheck) {
          router.push('/admin/dashboard');
          return;
        }
      }
      setLoading(false);
    });
  }, [router]);

  const handleContinue = async () => {
    if (!selectedRole) return;
    
    if (user) {
      // User is already logged in, update role via API
      try {
        const response = await fetch('/api/user/update-role', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ role: selectedRole }),
        });
        
        if (response.ok) {
          // Redirect based on role
          if (selectedRole === 'owner') {
            const businesses = await userService.getUserBusinesses(user.id);
            if (businesses && businesses.length > 0) {
              router.push('/owner/dashboard');
            } else {
              router.push('/setup');
            }
          } else {
            router.push('/categories/salon');
          }
        } else {
          // If update fails, still redirect based on role
          if (selectedRole === 'owner') {
            router.push('/setup');
          } else {
            router.push('/categories/salon');
          }
        }
      } catch {
        // On error, redirect based on role
        if (selectedRole === 'owner') {
          router.push('/setup');
        } else {
          router.push('/categories/salon');
        }
      }
    } else {
      // Redirect to login with role parameter
      router.push(`/auth/login?role=${selectedRole}&redirect_to=/auth/callback`);
    }
  };

  return (
    <div className="min-h-screen bg-white flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">Choose Your Role</h1>
          <p className="text-lg text-gray-600">
            Select how you want to use CusOwn
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2 mb-8">
          {/* Owner Option */}
          <button
            onClick={() => setSelectedRole('owner')}
            className={`p-8 rounded-xl border-2 transition-all text-left ${
              selectedRole === 'owner'
                ? 'border-black bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-black text-white">
              <svg
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Business Owner</h3>
            <p className="text-gray-600 mb-4">
              Create and manage your booking page. Accept bookings, manage slots, and grow your business.
            </p>
            <ul className="text-sm text-gray-500 space-y-1">
              <li>✓ Create booking pages</li>
              <li>✓ Manage appointments</li>
              <li>✓ Generate QR codes</li>
              <li>✓ Track bookings</li>
            </ul>
          </button>

          {/* Customer Option */}
          <button
            onClick={() => setSelectedRole('customer')}
            className={`p-8 rounded-xl border-2 transition-all text-left ${
              selectedRole === 'customer'
                ? 'border-black bg-gray-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-lg bg-black text-white">
              <svg
                className="h-8 w-8"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Customer</h3>
            <p className="text-gray-600 mb-4">
              Book appointments easily. Find services, select slots, and get instant confirmations.
            </p>
            <ul className="text-sm text-gray-500 space-y-1">
              <li>✓ Browse services</li>
              <li>✓ Book appointments</li>
              <li>✓ Instant confirmations</li>
              <li>✓ View your bookings</li>
            </ul>
          </button>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            onClick={handleContinue}
            disabled={!selectedRole}
            size="lg"
            className="w-full sm:w-auto px-8"
          >
            Continue
          </Button>
          <Link href="/">
            <Button variant="outline" size="lg" className="w-full sm:w-auto px-8">
              Back
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function SelectRolePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    }>
      <SelectRoleContent />
    </Suspense>
  );
}

