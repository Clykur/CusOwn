'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SLOT_DURATIONS, API_ROUTES } from '@/config/constants';
import { CreateSalonInput } from '@/types';

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState<CreateSalonInput>({
    salon_name: '',
    owner_name: '',
    whatsapp_number: '',
    opening_time: '10:00:00',
    closing_time: '21:00:00',
    slot_duration: '30',
    address: '',
    location: '',
  });
  const [success, setSuccess] = useState<{ bookingLink: string; bookingUrl: string } | null>(null);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    let processedValue = value;

    if ((name === 'opening_time' || name === 'closing_time') && value) {
      processedValue = value.length === 5 ? `${value}:00` : value;
    }

    setFormData((prev) => ({ ...prev, [name]: processedValue }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(API_ROUTES.SALONS, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to create salon');
      }

      if (result.success && result.data) {
        setSuccess({
          bookingLink: result.data.booking_link,
          bookingUrl: result.data.booking_url,
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-100 flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-green-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5 13l4 4L19 7"
                />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Salon Created Successfully!</h2>
            <p className="text-gray-600">Your booking page is ready to share</p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Booking Link
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={success.bookingUrl}
                  readOnly
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                />
                <button
                  onClick={() => copyToClipboard(success.bookingUrl)}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  Copy
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Next steps:</strong>
              </p>
              <ul className="text-sm text-blue-700 mt-2 space-y-1 list-disc list-inside">
                <li>Share this link on your WhatsApp status</li>
                <li>Add it to your Instagram bio</li>
                <li>Print a QR code for your salon</li>
                <li>Share it in your WhatsApp groups</li>
              </ul>
            </div>

            <button
              onClick={() => router.push('/')}
              className="w-full bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-lg hover:bg-gray-300 transition-colors"
            >
              Back to Home
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Salon</h1>
          <p className="text-gray-600 mb-8">Set up your booking page in minutes</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="salon_name" className="block text-sm font-medium text-gray-700 mb-2">
                Salon Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="salon_name"
                name="salon_name"
                value={formData.salon_name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Elite Salon"
              />
            </div>

            <div>
              <label htmlFor="owner_name" className="block text-sm font-medium text-gray-700 mb-2">
                Owner Name <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="owner_name"
                name="owner_name"
                value={formData.owner_name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label
                htmlFor="whatsapp_number"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                WhatsApp Number <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                id="whatsapp_number"
                name="whatsapp_number"
                value={formData.whatsapp_number}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="+919876543210"
              />
              <p className="mt-1 text-sm text-gray-500">Include country code (e.g., +91)</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="opening_time"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Opening Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="opening_time"
                  name="opening_time"
                  value={formData.opening_time.substring(0, 5)}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="closing_time"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Closing Time <span className="text-red-500">*</span>
                </label>
                <input
                  type="time"
                  id="closing_time"
                  name="closing_time"
                  value={formData.closing_time.substring(0, 5)}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="slot_duration"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Slot Duration (minutes) <span className="text-red-500">*</span>
              </label>
              <select
                id="slot_duration"
                name="slot_duration"
                value={formData.slot_duration}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
              >
                {SLOT_DURATIONS.map((duration) => (
                  <option key={duration} value={duration}>
                    {duration} minutes
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-2">
                Location <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="Bangalore, Karnataka"
              />
              <p className="mt-1 text-sm text-gray-500">City or area name</p>
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Full Address (Optional)
              </label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                placeholder="123 Main Street, Bangalore, Karnataka"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 text-white font-semibold py-3 px-6 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create My Booking Page'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

