'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { SLOT_DURATIONS, API_ROUTES, ERROR_MESSAGES } from '@/config/constants';
import { CreateSalonInput } from '@/types';
import { handleApiError, logError } from '@/lib/utils/error-handler';
import { supabaseAuth } from '@/lib/supabase/auth';

export default function SetupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [checkingAuth, setCheckingAuth] = useState(true);
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
  const [success, setSuccess] = useState<{ bookingLink: string; bookingUrl: string; qrCode?: string } | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      if (!supabaseAuth) {
        setCheckingAuth(false);
        return;
      }
      const { data: { session } } = await supabaseAuth.auth.getSession();
      setUser(session?.user ?? null);
      setCheckingAuth(false);
    };
    checkAuth();
  }, []);

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

      if (!response.ok) {
        const errorMessage = await handleApiError(response);
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setSuccess({
          bookingLink: result.data.booking_link,
          bookingUrl: result.data.booking_url,
          qrCode: result.data.qr_code || undefined,
        });
      }
    } catch (err) {
      logError(err, 'Salon Creation');
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (success) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-lg w-full bg-white rounded-lg shadow-lg p-8">
          <div className="text-center mb-6">
            <div className="w-16 h-16 bg-black rounded-full flex items-center justify-center mx-auto mb-4">
              <svg
                className="w-8 h-8 text-white"
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
                  className="px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-900 transition-colors text-sm font-medium"
                >
                  Copy
                </button>
              </div>
            </div>

            {/* QR Code Section */}
            {success.qrCode && (
              <div className="bg-white border-2 border-gray-300 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">QR Code</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Download and keep it safe. Stick it in your shop for customers to scan and book.
                </p>
                <div className="flex flex-col items-center space-y-4">
                  <div className="bg-white p-4 rounded-lg border-2 border-gray-200">
                    <img
                      src={success.qrCode}
                      alt="QR Code"
                      className="w-48 h-48"
                    />
                  </div>
                  <button
                    onClick={() => {
                      if (!success.qrCode) {
                        setError('QR code is not available. Please try accessing it from your dashboard.');
                        return;
                      }
                      const link = document.createElement('a');
                      link.href = success.qrCode;
                      link.download = `${success.bookingLink}-qr-code.png`;
                      document.body.appendChild(link);
                      link.click();
                      document.body.removeChild(link);
                    }}
                    className="w-full bg-black text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-900 transition-colors"
                  >
                    Download QR Code
                  </button>
                </div>
              </div>
            )}

            <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
              <p className="text-sm text-black">
                <strong>Next steps:</strong>
              </p>
              <ul className="text-sm text-black mt-2 space-y-1 list-disc list-inside">
                <li>Download and print the QR code above</li>
                <li>Stick it in your shop for easy access</li>
                <li>Share this link on your WhatsApp status</li>
                <li>Add it to your Instagram bio</li>
              </ul>
            </div>

            {/* Owner Dashboard CTA */}
            <div className="bg-black rounded-lg p-6 text-center">
              <h3 className="text-xl font-bold text-white mb-2">Manage Your Business</h3>
              <p className="text-gray-200 text-sm mb-4">
                View all bookings, check slot availability, and manage your business
              </p>
              <div className="space-y-3">
                <Link
                  href="/owner/dashboard"
                  className="inline-block w-full bg-white text-black font-semibold py-3 px-6 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  Go to My Dashboard →
                </Link>
                <Link
                  href={`/owner/${success.bookingLink}`}
                  className="inline-block w-full bg-gray-800 text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-700 transition-colors text-sm"
                >
                  View This Business Details
                </Link>
              </div>
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

  if (checkingAuth) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-white py-12 px-4">
        <div className="max-w-2xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <h1 className="text-3xl font-bold text-gray-900 mb-4">Sign In Required</h1>
            <p className="text-gray-600 mb-8">
              Please sign in with Google to create and manage your business. This helps us keep your account secure and allows you to access your dashboard anytime.
            </p>
            <button
              onClick={() => router.push('/auth/login?redirect_to=/setup')}
              className="px-6 py-3 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors mb-4"
            >
              Sign In with Google
            </button>
            <p className="text-sm text-gray-500">
              Don&apos;t have an account? Signing in will create one automatically.
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white py-12 px-4">
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Create Your Business</h1>
          <p className="text-gray-600 mb-8">Set up your booking page in minutes</p>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label htmlFor="salon_name" className="block text-sm font-medium text-gray-700 mb-2">
                Salon Name <span className="text-black">*</span>
              </label>
              <input
                type="text"
                id="salon_name"
                name="salon_name"
                value={formData.salon_name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="Elite Salon"
              />
            </div>

            <div>
              <label htmlFor="owner_name" className="block text-sm font-medium text-gray-700 mb-2">
                Owner Name <span className="text-black">*</span>
              </label>
              <input
                type="text"
                id="owner_name"
                name="owner_name"
                value={formData.owner_name}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="John Doe"
              />
            </div>

            <div>
              <label
                htmlFor="whatsapp_number"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                WhatsApp Number <span className="text-black">*</span>
              </label>
              <input
                type="tel"
                id="whatsapp_number"
                name="whatsapp_number"
                value={formData.whatsapp_number}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="9876543210"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label
                  htmlFor="opening_time"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Opening Time <span className="text-black">*</span>
                </label>
                <input
                  type="time"
                  id="opening_time"
                  name="opening_time"
                  value={formData.opening_time.substring(0, 5)}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>

              <div>
                <label
                  htmlFor="closing_time"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Closing Time <span className="text-black">*</span>
                </label>
                <input
                  type="time"
                  id="closing_time"
                  name="closing_time"
                  value={formData.closing_time.substring(0, 5)}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="slot_duration"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Slot Duration (minutes) <span className="text-black">*</span>
              </label>
              <select
                id="slot_duration"
                name="slot_duration"
                value={formData.slot_duration}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
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
                Location <span className="text-black">*</span>
              </label>
              <input
                type="text"
                id="location"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="Bangalore, Karnataka"
              />
              <p className="mt-1 text-sm text-gray-500">City or area name</p>
            </div>

            <div>
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-2">
                Full Address <span className="text-black">*</span>
              </label>
              <textarea
                id="address"
                name="address"
                value={formData.address}
                onChange={handleChange}
                required
                rows={3}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
                placeholder="123 Main Street, Bangalore, Karnataka"
              />
              <p className="mt-1 text-sm text-gray-500">This address will be sent to customers with a Google Maps link</p>
            </div>

            {error && (
              <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded-lg">
                <p className="mb-2">{error}</p>
                {error.includes('/b/') && (
                  <div className="mt-3">
                    <Link
                      href={error.match(/\/b\/[^\s]+/)?.[0] || '/owner/dashboard'}
                      className="text-red-800 underline font-semibold hover:text-red-900"
                    >
                      Go to Your Existing Business →
                    </Link>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-black text-white font-semibold py-3 px-6 rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Creating...' : 'Create My Booking Page'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

