'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { API_ROUTES, ERROR_MESSAGES } from '@/config/constants';
import { Salon, BookingWithDetails, Slot } from '@/types';
import { formatDate, formatTime } from '@/lib/utils/string';
import { handleApiError, logError } from '@/lib/utils/error-handler';

export default function OwnerDashboardPage() {
  const params = useParams();
  const bookingLink = params.bookingLink as string;
  const [salon, setSalon] = useState<Salon | null>(null);
  const [bookings, setBookings] = useState<BookingWithDetails[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'bookings' | 'slots'>('bookings');

  useEffect(() => {
    if (!bookingLink) return;

    const fetchSalon = async () => {
      try {
        const response = await fetch(`${API_ROUTES.SALONS}/${bookingLink}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Salon not found');
        }

        if (result.success && result.data) {
          setSalon(result.data);
          
          // If QR code doesn't exist, fetch it
          if (!result.data.qr_code) {
            try {
              const qrResponse = await fetch(`${API_ROUTES.SALONS}/${bookingLink}/qr`);
              if (!qrResponse.ok) {
                throw new Error(await handleApiError(qrResponse));
              }
              const qrResult = await qrResponse.json();
              if (qrResult.success && qrResult.data?.qr_code) {
                setSalon((prev) => prev ? { ...prev, qr_code: qrResult.data.qr_code } : null);
              }
            } catch (qrError) {
              logError(qrError, 'QR Code Fetch');
              // Don't show error to user - QR code is optional
            }
          }
        }
      } catch (err) {
        logError(err, 'Salon Fetch');
        setError(err instanceof Error ? err.message : ERROR_MESSAGES.LOADING_ERROR);
      } finally {
        setLoading(false);
      }
    };

    fetchSalon();
  }, [bookingLink]);

  useEffect(() => {
    if (!salon) return;

    const date = selectedDate || new Date().toISOString().split('T')[0];

    const fetchBookings = async () => {
      try {
        const response = await fetch(`${API_ROUTES.BOOKINGS}/salon/${salon.id}?date=${date}`);
        const result = await response.json();

        if (result.success && result.data) {
          setBookings(result.data);
        } else {
          throw new Error(result.error || ERROR_MESSAGES.LOADING_ERROR);
        }
      } catch (err) {
        logError(err, 'Bookings Fetch');
        // Don't show error - just show empty state
      }
    };

    const fetchSlots = async () => {
      try {
        const response = await fetch(`${API_ROUTES.SLOTS}?salon_id=${salon.id}&date=${date}`);
        const result = await response.json();

        if (result.success && result.data) {
          setSlots(result.data);
        }
      } catch (err) {
        logError(err, 'Slots Fetch');
        // Don't show error - just show empty state
      }
    };

    fetchBookings();
    fetchSlots();
  }, [salon, selectedDate]);

  useEffect(() => {
    setSelectedDate(new Date().toISOString().split('T')[0]);
  }, []);

  const downloadQRCode = () => {
    if (!salon?.qr_code) return;

    const link = document.createElement('a');
    link.href = salon.qr_code;
    link.download = `${salon.booking_link}-qr-code.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

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

  if (error || !salon) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h2>
          <p className="text-gray-600 mb-8">Invalid booking link or salon not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{salon.salon_name}</h1>
          <p className="text-gray-600">Owner Dashboard</p>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* QR Code Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">QR Code</h2>
            <p className="text-sm text-gray-600 mb-4">
              Download and keep it safe. Stick it in your shop for customers to scan and book.
            </p>
            
            {salon.qr_code ? (
              <div className="space-y-4">
                <div className="flex justify-center bg-white p-4 rounded-lg border-2 border-gray-200">
                  <img
                    src={salon.qr_code}
                    alt="QR Code"
                    className="w-64 h-64"
                  />
                </div>
                <button
                  onClick={downloadQRCode}
                  className="w-full bg-black text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-900 transition-colors"
                >
                  Download QR Code
                </button>
                <p className="text-xs text-gray-500 text-center">
                  Scan this QR code to open your booking page
                </p>
              </div>
            ) : (
              <div className="text-center py-8">
                <p className="text-gray-500">QR code is being generated...</p>
              </div>
            )}
          </div>

          {/* Bookings & Slots Section */}
          <div className="bg-white rounded-lg shadow-lg p-8">
            <div className="flex gap-2 mb-4 border-b border-gray-200">
              <button
                onClick={() => setActiveTab('bookings')}
                className={`px-4 py-2 font-semibold transition-colors ${
                  activeTab === 'bookings'
                    ? 'text-black border-b-2 border-black'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Bookings
              </button>
              <button
                onClick={() => setActiveTab('slots')}
                className={`px-4 py-2 font-semibold transition-colors ${
                  activeTab === 'slots'
                    ? 'text-black border-b-2 border-black'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Slots Status
              </button>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
              />
            </div>

            {activeTab === 'bookings' ? (
              <div className="space-y-4 max-h-96 overflow-y-auto">
                {bookings.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No bookings found for this date</p>
                ) : (
                  bookings.map((booking) => (
                    <div
                      key={booking.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex justify-between items-start mb-3">
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
                        <div className="grid grid-cols-2 gap-3 text-sm">
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

                      <div className="mt-3 pt-3 border-t border-gray-200">
                        <p className="text-xs text-gray-500">
                          Booking ID: <span className="font-mono">{booking.booking_id}</span>
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {slots.length === 0 ? (
                  <p className="text-gray-500 text-center py-8">No slots found for this date</p>
                ) : (
                  slots.map((slot) => (
                    <div
                      key={slot.id}
                      className={`border-2 rounded-lg p-3 ${
                        slot.status === 'booked'
                          ? 'border-black bg-gray-50'
                          : slot.status === 'reserved'
                          ? 'border-yellow-400 bg-yellow-50'
                          : 'border-gray-200 bg-white'
                      }`}
                    >
                      <div className="flex justify-between items-center">
                        <div>
                          <p className="font-semibold text-gray-900">
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                          </p>
                        </div>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-medium ${
                            slot.status === 'booked'
                              ? 'bg-black text-white'
                              : slot.status === 'reserved'
                              ? 'bg-yellow-400 text-black'
                              : 'bg-gray-200 text-gray-700'
                          }`}
                        >
                          {slot.status === 'booked' ? 'Booked' : slot.status === 'reserved' ? 'Reserved' : 'Available'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

