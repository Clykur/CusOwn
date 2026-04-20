'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  APP_SCREEN_TITLE_CLASSNAME,
  SLOT_DURATIONS,
  API_ROUTES,
  ERROR_MESSAGES,
  VALIDATION,
  UI_CONTEXT,
  BUSINESS_CATEGORIES_FALLBACK,
  DEFAULT_CONCURRENT_BOOKING_CAPACITY,
  MAX_CONCURRENT_BOOKING_CAPACITY,
} from '@/config/constants';
import { CreateSalonInput } from '@/types';
import { logError } from '@/lib/utils/error-handler';
import { getServerSessionClient } from '@/lib/auth/server-session-client';
import { ROUTES } from '@/lib/utils/navigation';

type ServiceDraftRow = { name: string; duration_minutes: number; price_inr: number };
import { getCSRFToken, clearCSRFToken } from '@/lib/utils/csrf-client';
import { formatPhoneNumber } from '@/lib/utils/string';

export type CreateBusinessFormProps = {
  redirectAfterSuccess?: string;
  /** When true, render without full-page wrapper (for owner layout). */
  embedded?: boolean;
  /** Called on successful business creation instead of navigating. When provided, the component will NOT auto-redirect. */
  onSuccess?: (data: { bookingLink: string; bookingUrl: string; qrCode?: string }) => void;
};

export default function CreateBusinessForm({
  redirectAfterSuccess,
  onSuccess,
}: CreateBusinessFormProps) {
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
    category: 'salon',
    city: '',
    area: '',
    pincode: '',
    latitude: 0,
    longitude: 0,
    concurrent_booking_capacity: DEFAULT_CONCURRENT_BOOKING_CAPACITY,
  });
  const [ownerBusinesses, setOwnerBusinesses] = useState<
    { salon_name: string; whatsapp_number: string }[] | null
  >(null);
  const [businessCategories, setBusinessCategories] = useState<{ value: string; label: string }[]>(
    BUSINESS_CATEGORIES_FALLBACK
  );
  const [serviceRows, setServiceRows] = useState<ServiceDraftRow[]>([
    { name: '', duration_minutes: 30, price_inr: 0 },
  ]);

  useEffect(() => {
    getCSRFToken().catch(console.error);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(API_ROUTES.BUSINESS_CATEGORIES, { credentials: 'include' })
      .then((r) => r.json())
      .then((res) => {
        if (cancelled) return;
        const list = res?.data && Array.isArray(res.data) ? res.data : [];
        setBusinessCategories(list.length ? list : BUSINESS_CATEGORIES_FALLBACK);
      })
      .catch(() => {
        if (!cancelled) setBusinessCategories(BUSINESS_CATEGORIES_FALLBACK);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    getServerSessionClient().then(({ user }) => {
      if (!user || cancelled) return;
      fetch('/api/owner/businesses', { credentials: 'include' })
        .then((r) => r.json())
        .then((res) => {
          if (cancelled || !res?.data?.length) return;
          setOwnerBusinesses(
            res.data.map((b: { salon_name: string; whatsapp_number: string }) => ({
              salon_name: b.salon_name,
              whatsapp_number: b.whatsapp_number,
            }))
          );
        })
        .catch(() => {});
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const whatsappReuseHint = useMemo(() => {
    const digits = formData.whatsapp_number.replace(/\D/g, '');
    if (digits.length !== VALIDATION.WHATSAPP_NUMBER_MIN_LENGTH || !ownerBusinesses?.length)
      return null;
    const formatted = formatPhoneNumber(formData.whatsapp_number);
    const existing = ownerBusinesses.find(
      (b) => formatPhoneNumber(b.whatsapp_number) === formatted
    );
    return existing?.salon_name ?? null;
  }, [formData.whatsapp_number, ownerBusinesses]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    let processedValue = value;
    if (name === 'concurrent_booking_capacity') {
      const n = Math.min(
        MAX_CONCURRENT_BOOKING_CAPACITY,
        Math.max(1, parseInt(value, 10) || DEFAULT_CONCURRENT_BOOKING_CAPACITY)
      );
      setFormData((prev) => ({ ...prev, concurrent_booking_capacity: n }));
      setError(null);
      return;
    }
    if ((name === 'opening_time' || name === 'closing_time') && value) {
      processedValue = value.length === 5 ? `${value}:00` : value;
    }
    if (name === 'whatsapp_number') {
      const digitsOnly = value.replace(/\D/g, '').slice(0, VALIDATION.WHATSAPP_NUMBER_MAX_LENGTH);
      processedValue = digitsOnly;
    }
    setFormData((prev) => ({ ...prev, [name]: processedValue }));
    setError(null);
  };

  const validateForm = (): string | null => {
    if (!formData.salon_name.trim() || formData.salon_name.trim().length < 2) {
      return 'Business name must be at least 2 characters';
    }
    if (!formData.owner_name.trim() || formData.owner_name.trim().length < 2) {
      return 'Owner name must be at least 2 characters';
    }
    const whatsappDigits = formData.whatsapp_number.replace(/\D/g, '');
    if (whatsappDigits.length !== VALIDATION.WHATSAPP_NUMBER_MIN_LENGTH) {
      return ERROR_MESSAGES.WHATSAPP_NUMBER_INVALID;
    }
    if (formData.opening_time >= formData.closing_time) {
      return 'Closing time must be after opening time';
    }
    if (!formData.address.trim() || formData.address.trim().length < 5) {
      return 'Address is required (minimum 5 characters)';
    }
    if (!formData.location.trim() || formData.location.trim().length < 2) {
      return 'Location/Area is required';
    }
    if (!formData.city?.trim()) {
      return 'City is required';
    }
    if (!formData.latitude || !formData.longitude) {
      return 'Please set your business location (coordinates)';
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { user: sessionUser } = await getServerSessionClient();
      if (!sessionUser) {
        throw new Error('Authentication required. Please sign in again.');
      }
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      const servicesPayload = serviceRows
        .filter((s) => s.name.trim().length > 0)
        .map((s) => ({
          name: s.name.trim(),
          duration_minutes: Math.max(1, Math.floor(Number(s.duration_minutes)) || 1),
          price_cents: Math.max(0, Math.round(Number(s.price_inr) * 100)),
        }));

      const response = await fetch(API_ROUTES.SALONS, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          ...formData,
          ...(servicesPayload.length > 0 ? { services: servicesPayload } : {}),
        }),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `Failed to create business (${response.status})`);
      }
      const result = await response.json();
      if (result.success && result.data) {
        if (onSuccess) {
          const qrCode = result.qr_code || undefined;
          onSuccess({
            bookingLink: result.data.booking_link,
            bookingUrl: `${window.location.origin}/b/${result.data.booking_link}`,
            qrCode,
          });
        } else if (redirectAfterSuccess) {
          router.push(redirectAfterSuccess);
        } else {
          router.push(ROUTES.OWNER_BUSINESS_SETUP(result.data.id));
        }
        return;
      } else {
        throw new Error(result.error || 'Failed to create business. Please try again.');
      }
    } catch (err) {
      logError(err, 'Salon Creation');
      setError(err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR);
      clearCSRFToken();
    } finally {
      setLoading(false);
    }
  };

  const handleUseLocation = async () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        try {
          const res = await fetch(
            `/api/geo/reverse-geocode?latitude=${latitude}&longitude=${longitude}`
          );
          if (!res.ok) throw new Error('Failed to fetch address');
          const result = await res.json();
          if (result.success && result.data) {
            const { city, region } = result.data;
            setFormData((prev) => ({
              ...prev,
              latitude,
              longitude,
              city: city || prev.city,
              area: region || prev.area,
              address: [city, region].filter(Boolean).join(', '),
              location: city || '',
            }));
          }
        } catch (err) {
          console.error('Error reverse geocoding:', err);
          setFormData((prev) => ({ ...prev, latitude, longitude }));
        } finally {
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error getting location:', err);
        setLoading(false);
        alert('Could not get your location. Please enter it manually.');
      },
      { timeout: 10000 }
    );
  };
  const lat = Number(formData.latitude);
  const lng = Number(formData.longitude);

  const mapsUrl = useMemo(() => {
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    try {
      const u = new URL('https://www.google.com/maps/search/');
      u.searchParams.set('api', '1');
      u.searchParams.set('query', `${lat},${lng}`);
      return u.toString();
    } catch {
      return null;
    }
  }, [lat, lng]);

  const existingBusinessPathFromError = useMemo(() => {
    if (!error || !error.includes('/b/')) return null;
    const m = error.match(/\/b\/[A-Za-z0-9_-]{1,128}/);
    return m ? m[0] : null;
  }, [error]);
  const formContent = (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
        <div className="flex justify-center items-center py-6">
          <h1 className={APP_SCREEN_TITLE_CLASSNAME}>Create Your Business</h1>
        </div>
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3 md:p-4 mb-4">
          <p className="text-xs md:text-sm text-blue-800">
            <strong className="font-semibold">Tip:</strong> You can create multiple businesses
            later. Each business gets its own booking link and QR code.
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
          <label
            htmlFor="salon_name"
            className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-2"
          >
            Business Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="salon_name"
            name="salon_name"
            value={formData.salon_name}
            onChange={handleChange}
            required
            minLength={2}
            maxLength={100}
            className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
            placeholder="Elite Salon"
          />
        </div>
        <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
          <label
            htmlFor="category"
            className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-2"
          >
            Business type <span className="text-red-500">*</span>
          </label>
          <select
            id="category"
            name="category"
            value={
              businessCategories.some((c) => c.value === (formData.category ?? 'salon'))
                ? (formData.category ?? 'salon')
                : (businessCategories[0]?.value ?? 'salon')
            }
            onChange={handleChange}
            required
            className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
          >
            {businessCategories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
          <label
            htmlFor="owner_name"
            className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-2"
          >
            Owner Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="owner_name"
            name="owner_name"
            value={formData.owner_name}
            onChange={handleChange}
            required
            minLength={2}
            maxLength={100}
            className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
            placeholder="John Doe"
          />
        </div>
        <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
          <label
            htmlFor="whatsapp_number"
            className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-2"
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
            pattern="[0-9]{10}"
            maxLength={VALIDATION.WHATSAPP_NUMBER_MAX_LENGTH}
            className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
            placeholder="10 digits"
            inputMode="numeric"
            autoComplete="tel"
          />
          {whatsappReuseHint && (
            <p className="mt-1.5 text-sm text-gray-600" role="status">
              {UI_CONTEXT.WHATSAPP_ALREADY_USED_FOR(whatsappReuseHint)}
            </p>
          )}
        </div>
        <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
          <label className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-3">
            Business Hours <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3 md:gap-4">
            <div>
              <label
                htmlFor="opening_time"
                className="block text-xs font-medium text-gray-700 mb-1.5"
              >
                Opening Time
              </label>
              <input
                type="time"
                id="opening_time"
                name="opening_time"
                value={formData.opening_time.substring(0, 5)}
                onChange={handleChange}
                required
                className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
              />
            </div>
            <div>
              <label
                htmlFor="closing_time"
                className="block text-xs font-medium text-gray-700 mb-1.5"
              >
                Closing Time
              </label>
              <input
                type="time"
                id="closing_time"
                name="closing_time"
                value={formData.closing_time.substring(0, 5)}
                onChange={handleChange}
                required
                className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
              />
            </div>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
          <label
            htmlFor="slot_duration"
            className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-2"
          >
            Appointment Duration <span className="text-red-500">*</span>
          </label>
          <select
            id="slot_duration"
            name="slot_duration"
            value={formData.slot_duration}
            onChange={handleChange}
            required
            className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
          >
            {SLOT_DURATIONS.map((d) => (
              <option key={d} value={d}>
                {d} minutes
              </option>
            ))}
          </select>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
          <label
            htmlFor="concurrent_booking_capacity"
            className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-2"
          >
            Concurrent bookings (chairs / stations)
          </label>
          <input
            type="number"
            id="concurrent_booking_capacity"
            name="concurrent_booking_capacity"
            min={1}
            max={MAX_CONCURRENT_BOOKING_CAPACITY}
            value={formData.concurrent_booking_capacity ?? DEFAULT_CONCURRENT_BOOKING_CAPACITY}
            onChange={handleChange}
            className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
          />
          <p className="mt-1.5 text-xs text-gray-600">
            How many appointments can run at the same time (default{' '}
            {DEFAULT_CONCURRENT_BOOKING_CAPACITY}).
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <label className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900">
              Services (optional)
            </label>
            <button
              type="button"
              onClick={() =>
                setServiceRows((rows) => [
                  ...rows,
                  { name: '', duration_minutes: 30, price_inr: 0 },
                ])
              }
              className="text-xs font-semibold text-blue-600 hover:text-blue-800"
            >
              + Add service
            </button>
          </div>
          <div className="space-y-3">
            {serviceRows.map((row, index) => (
              <div
                key={index}
                className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-end border-b border-gray-200 pb-3 last:border-0"
              >
                <div className="sm:col-span-5">
                  <label className="block text-xs text-gray-600 mb-1">Name</label>
                  <input
                    type="text"
                    value={row.name}
                    onChange={(e) => {
                      const v = e.target.value;
                      setServiceRows((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, name: v } : r))
                      );
                    }}
                    className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg bg-white"
                    placeholder="e.g. Haircut"
                    maxLength={200}
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs text-gray-600 mb-1">Duration (min)</label>
                  <input
                    type="number"
                    min={1}
                    value={row.duration_minutes}
                    onChange={(e) => {
                      const v = Math.max(1, parseInt(e.target.value, 10) || 1);
                      setServiceRows((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, duration_minutes: v } : r))
                      );
                    }}
                    className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg bg-white"
                  />
                </div>
                <div className="sm:col-span-3">
                  <label className="block text-xs text-gray-600 mb-1">Price (₹)</label>
                  <input
                    type="number"
                    min={0}
                    step={0.01}
                    value={row.price_inr}
                    onChange={(e) => {
                      const v = Math.max(0, parseFloat(e.target.value) || 0);
                      setServiceRows((prev) =>
                        prev.map((r, i) => (i === index ? { ...r, price_inr: v } : r))
                      );
                    }}
                    className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg bg-white"
                  />
                </div>
                <div className="sm:col-span-1 flex justify-end">
                  {serviceRows.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setServiceRows((prev) => prev.filter((_, i) => i !== index))}
                      className="text-xs font-medium text-red-600 hover:text-red-800"
                      aria-label="Remove service row"
                    >
                      Remove
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Leave rows empty to skip; you can add services later. Price is stored in paise (₹ ×
            100).
          </p>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <label className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900">
              Business Location <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={handleUseLocation}
              disabled={loading}
              className="text-xs font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-50"
            >
              Use My Current Location
            </button>
          </div>

          <div className="space-y-3">
            <input
              type="text"
              name="address"
              value={formData.address}
              onChange={handleChange}
              required
              minLength={5}
              maxLength={500}
              className="w-full px-3 md:px-4 py-2 text-sm border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
              placeholder="Street address and building details"
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                name="city"
                value={formData.city || ''}
                onChange={handleChange}
                required
                className="w-full px-3 md:px-4 py-2 text-sm border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
                placeholder="City"
              />
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                required
                minLength={2}
                maxLength={100}
                className="w-full px-3 md:px-4 py-2 text-sm border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
                placeholder="Area/Locality"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <input
                type="text"
                name="area"
                value={formData.area || ''}
                onChange={handleChange}
                maxLength={100}
                className="w-full px-3 md:px-4 py-2 text-sm border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
                placeholder="Sub-area (Optional)"
              />
              <input
                type="text"
                name="pincode"
                value={formData.pincode || ''}
                onChange={handleChange}
                maxLength={10}
                className="w-full px-3 md:px-4 py-2 text-sm border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
                placeholder="Pincode (Optional)"
              />
            </div>

            {formData.latitude !== 0 && formData.longitude !== 0 && (
              <div className="mt-2 p-3 bg-white border border-gray-200 rounded-lg text-xs text-gray-500">
                <p className="font-semibold text-gray-700 mb-1">Map Preview (Coordinates)</p>
                <p>
                  Lat: {formData.latitude!.toFixed(6)}, Lng: {formData.longitude!.toFixed(6)}
                </p>
                <a
                  href={mapsUrl || '#'}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1 inline-block text-blue-600 hover:underline"
                >
                  View on Google Maps →
                </a>
              </div>
            )}
          </div>
        </div>
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
            <p className="text-red-800 font-medium">{error}</p>
            {existingBusinessPathFromError && (
              <Link
                href={existingBusinessPathFromError}
                className="text-red-700 underline font-semibold mt-2 inline-block"
              >
                Go to Your Existing Business →
              </Link>
            )}
          </div>
        )}
        <div className="space-y-3 pt-3">
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-black text-white font-semibold py-3 md:py-4 px-6 rounded-xl hover:bg-gray-900 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <span className="animate-spin rounded-full h-4 w-4 md:h-5 md:w-5 border-2 border-white border-t-transparent" />
                <span>Creating Your Booking Page...</span>
              </>
            ) : (
              <span>Create My Booking Page</span>
            )}
          </button>
          <Link href={ROUTES.OWNER_DASHBOARD_BASE}>
            <button
              type="button"
              disabled={loading}
              className="w-full text-gray-600 hover:text-gray-900 text-xs md:text-sm disabled:opacity-50 font-medium mt-2"
            >
              Already have a business? Go to Dashboard →
            </button>
          </Link>
        </div>
      </form>
    </>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-8">
      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">{formContent}</div>
    </div>
  );
}
