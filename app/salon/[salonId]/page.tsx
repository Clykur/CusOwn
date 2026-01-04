'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { API_ROUTES } from '@/config/constants';
import { Salon, Slot } from '@/types';
import { formatDate, formatTime } from '@/lib/utils/string';
import { isSlotTimePassed, isTimeInRange } from '@/lib/utils/time';
import { whatsappService } from '@/services/whatsapp.service';

export default function SalonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const salonId = params.salonId as string;
  const [salon, setSalon] = useState<Salon | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!salonId) return;

    const fetchSalon = async () => {
      try {
        const response = await fetch(`/api/salons/${salonId}`);
        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || 'Salon not found');
        }

        if (result.success && result.data) {
          setSalon(result.data);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load salon');
      } finally {
        setLoading(false);
      }
    };

    fetchSalon();
  }, [salonId]);

  useEffect(() => {
    if (!salon || !selectedDate) return;

    const fetchSlots = async () => {
      try {
        const response = await fetch(
          `${API_ROUTES.SLOTS}?salon_id=${salon.id}&date=${selectedDate}`
        );
        const result = await response.json();

        if (result.success && result.data) {
          setSlots(result.data);
        }
      } catch (err) {
        console.error('Failed to load slots:', err);
      }
    };

    fetchSlots();
  }, [salon, selectedDate]);

  useEffect(() => {
    const today = new Date().toISOString().split('T')[0];
    setSelectedDate(today);
  }, []);

  const handleSlotSelect = (slot: Slot) => {
    if (slot.status === 'booked') return;
    setSelectedSlot(slot);
    setError(null);
  };

  const handleBookSlot = async () => {
    if (!selectedSlot || !salon) {
      setError('Please select a time slot');
      return;
    }

    if (!customerName.trim()) {
      setError('Please enter your name');
      return;
    }

    if (!customerPhone.trim()) {
      setError('Please enter your phone number');
      return;
    }

    try {
      const response = await fetch(API_ROUTES.BOOKINGS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          salon_id: salon.id,
          slot_id: selectedSlot.id,
          customer_name: customerName.trim(),
          customer_phone: customerPhone.trim(),
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create booking');
      }

      if (result.success && result.data) {
        window.open(result.data.whatsapp_url, '_blank');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (error && !salon) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-pink-100 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Salon Not Found</h2>
          <p className="text-gray-600 mb-8">{error}</p>
          <Link href="/categories/salon">
            <Button>Back to Salons</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!salon) return null;

  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const availableSlots = slots.filter((s) => s.status === 'available');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-4xl mx-auto">
        <Link href="/categories/salon" className="text-indigo-600 hover:text-indigo-700 mb-4 inline-block">
          ← Back to Salons
        </Link>

        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">{salon.salon_name}</h1>
          {salon.location && (
            <p className="text-gray-600 mb-4 flex items-center gap-2">
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
              {salon.location}
            </p>
          )}
          {salon.address && <p className="text-gray-600 mb-4">{salon.address}</p>}
          <p className="text-sm text-gray-500">
            Open: {salon.opening_time.substring(0, 5)} - {salon.closing_time.substring(0, 5)}
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Book Your Slot</h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => setSelectedDate(today.toISOString().split('T')[0])}
                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                  selectedDate === today.toISOString().split('T')[0]
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Today ({formatDate(today.toISOString().split('T')[0])})
              </button>
              <button
                onClick={() => setSelectedDate(tomorrow.toISOString().split('T')[0])}
                className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                  selectedDate === tomorrow.toISOString().split('T')[0]
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                    : 'border-gray-300 text-gray-700 hover:border-gray-400'
                }`}
              >
                Tomorrow ({formatDate(tomorrow.toISOString().split('T')[0])})
              </button>
            </div>
          </div>

          {selectedDate && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Time</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {slots.length === 0 ? (
                  <p className="col-span-full text-gray-500 text-center py-4">
                    No slots available for this date
                  </p>
                ) : (
                  slots.map((slot) => {
                    const isSelected = selectedSlot?.id === slot.id;
                    const isBooked = slot.status === 'booked';

                    return (
                      <button
                        key={slot.id}
                        onClick={() => handleSlotSelect(slot)}
                        disabled={isBooked}
                        className={`px-4 py-2 rounded-lg border-2 transition-colors ${
                          isBooked
                            ? 'border-gray-200 bg-gray-100 text-gray-400 cursor-not-allowed'
                            : isSelected
                            ? 'border-indigo-600 bg-indigo-50 text-indigo-700'
                            : 'border-gray-300 text-gray-700 hover:border-indigo-300'
                        }`}
                      >
                        {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                        {isBooked && ' (Full)'}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label htmlFor="customer_name" className="block text-sm font-medium text-gray-700 mb-2">
                Your Name <span className="text-red-500">*</span>
              </label>
              <Input
                type="text"
                id="customer_name"
                value={customerName}
                onChange={(e) => setCustomerName(e.target.value)}
                placeholder="John Doe"
              />
            </div>

            <div>
              <label htmlFor="customer_phone" className="block text-sm font-medium text-gray-700 mb-2">
                Phone Number <span className="text-red-500">*</span>
              </label>
              <Input
                type="tel"
                id="customer_phone"
                value={customerPhone}
                onChange={(e) => setCustomerPhone(e.target.value)}
                placeholder="+919876543210"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <Button
              onClick={handleBookSlot}
              disabled={!selectedSlot}
              size="lg"
              className="w-full"
            >
              Book Slot via WhatsApp
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

