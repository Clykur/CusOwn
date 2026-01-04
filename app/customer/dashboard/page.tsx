'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabaseAuth } from '@/lib/supabase/auth';
import { formatDate, formatTime } from '@/lib/utils/string';

export default function CustomerDashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      if (!supabaseAuth) {
        router.push('/auth/login?redirect_to=/customer/dashboard');
        return;
      }
      const { data: { session } } = await supabaseAuth.auth.getSession();
      
      if (!session?.user) {
        router.push('/auth/login?redirect_to=/customer/dashboard');
        return;
      }

      setUser(session.user);

      // Fetch user's bookings
      try {
        const response = await fetch('/api/customer/bookings');
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            setBookings(result.data || []);
          }
        }
      } catch (err) {
        console.error('Failed to fetch bookings:', err);
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

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">My Bookings</h1>
            <p className="text-gray-600">View and manage your appointments</p>
          </div>
          <Link
            href="/categories/salon"
            className="px-6 py-2 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
          >
            Book Appointment
          </Link>
        </div>

        {/* Become Owner CTA */}
        <div className="mb-8 bg-gray-50 border-2 border-gray-200 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">Own a Business?</h3>
              <p className="text-gray-600">
                Create your booking page and start accepting appointments from customers.
              </p>
            </div>
            <Link
              href="/select-role?role=owner"
              className="px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors whitespace-nowrap"
            >
              Become Owner
            </Link>
          </div>
        </div>

        {bookings.length === 0 ? (
          <div className="bg-white rounded-lg shadow-lg p-12 text-center">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">No Bookings Yet</h2>
            <p className="text-gray-600 mb-8">
              Start booking appointments to see them here
            </p>
            <Link
              href="/categories/salon"
              className="inline-block px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors"
            >
              Book Your First Appointment
            </Link>
          </div>
        ) : (
          <div className="grid gap-6">
            {bookings.map((booking) => (
              <div
                key={booking.id}
                className="bg-white rounded-lg shadow-lg p-6 border-2 border-gray-200"
              >
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-xl font-semibold text-gray-900">
                      {booking.business?.salon_name || 'Business'}
                    </h3>
                    {booking.business?.location && (
                      <p className="text-sm text-gray-500 mt-1">{booking.business.location}</p>
                    )}
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      booking.status === 'confirmed'
                        ? 'bg-black text-white'
                        : booking.status === 'pending'
                        ? 'bg-gray-200 text-black'
                        : 'bg-gray-300 text-black'
                    }`}
                  >
                    {booking.status}
                  </span>
                </div>

                {booking.slot && (
                  <div className="grid grid-cols-2 gap-4 text-sm mb-4">
                    <div>
                      <p className="text-gray-500">Date</p>
                      <p className="font-semibold text-gray-900">
                        {formatDate(booking.slot.date)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Time</p>
                      <p className="font-semibold text-gray-900">
                        {formatTime(booking.slot.start_time)} - {formatTime(booking.slot.end_time)}
                      </p>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
                    Booking ID: <span className="font-mono">{booking.booking_id}</span>
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

