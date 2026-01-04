'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { API_ROUTES, ERROR_MESSAGES } from '@/config/constants';
import { BookingWithDetails, Salon } from '@/types';
import { formatDate, formatTime } from '@/lib/utils/string';
import { logError } from '@/lib/utils/error-handler';

export default function DashboardPage() {
  const params = useParams();
  const salonId = params.salonId as string;
  const [salon, setSalon] = useState<Salon | null>(null);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');

  useEffect(() => {
    if (!salonId) return;

    const fetchSalon = async () => {
      try {
        const response = await fetch(`${API_ROUTES.SALONS}/${salonId}`);
        const result = await response.json();

        if (result.success && result.data) {
          setSalon(result.data);
        }
      } catch (err) {
        logError(err, 'Salon Fetch');
      }
    };

    fetchSalon();
  }, [salonId]);

  useEffect(() => {
    if (!salonId) return;

    const date = selectedDate || new Date().toISOString().split('T')[0];

    const fetchBookings = async () => {
      try {
        const response = await fetch(`${API_ROUTES.BOOKINGS}/salon/${salonId}?date=${date}`);
        const result = await response.json();

        if (result.success && result.data) {
          setBookings(result.data);
        }
      } catch (err) {
        logError(err, 'Bookings Fetch');
      } finally {
        setLoading(false);
      }
    };

    fetchBookings();
  }, [salonId, selectedDate]);

  useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'confirmed':
        return 'bg-black text-white';
      case 'pending':
        return 'bg-gray-200 text-black';
      case 'rejected':
        return 'bg-gray-300 text-black';
      case 'cancelled':
        return 'bg-gray-100 text-black';
      default:
        return 'bg-gray-100 text-black';
    }
  };

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
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{salon?.salon_name}</h1>
          <p className="text-gray-600 mb-8">Booking Dashboard</p>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          <div className="space-y-4">
            {bookings.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">No bookings found for this date</p>
              </div>
            ) : (
              bookings.map((booking) => (
                <div
                  key={booking.id}
                  className="border border-gray-200 rounded-lg p-6 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{booking.customer_name}</h3>
                      <p className="text-sm text-gray-500">{booking.customer_phone}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(
                        booking.status
                      )}`}
                    >
                      {booking.status}
                    </span>
                  </div>

                  {booking.slot && (
                    <div className="grid grid-cols-2 gap-4 text-sm">
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

                  <div className="mt-4 pt-4 border-t border-gray-200">
                    <p className="text-xs text-gray-500">
                      Booking ID: <span className="font-mono">{booking.booking_id}</span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

