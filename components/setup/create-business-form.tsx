'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import {
  SLOT_DURATIONS,
  API_ROUTES,
  ERROR_MESSAGES,
  VALIDATION,
  UI_CONTEXT,
  BUSINESS_CATEGORIES_FALLBACK,
} from '@/config/constants';
import { CreateSalonInput } from '@/types';
import { logError } from '@/lib/utils/error-handler';
import { getServerSessionClient } from '@/lib/auth/server-session-client';
import { ROUTES, getOwnerDashboardUrl } from '@/lib/utils/navigation';
import OnboardingProgress from '@/components/onboarding/onboarding-progress';
import { getCSRFToken, clearCSRFToken } from '@/lib/utils/csrf-client';
import { formatPhoneNumber } from '@/lib/utils/string';

export type CreateBusinessFormProps = {
  redirectAfterSuccess?: string;
  showOnboardingProgress?: boolean;
  /** When true, render without full-page wrapper (for owner layout). */
  embedded?: boolean;
};

export default function CreateBusinessForm({
  redirectAfterSuccess = ROUTES.OWNER_DASHBOARD_BASE,
  showOnboardingProgress = false,
  embedded = false,
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
  });
  const [success, setSuccess] = useState<{
    bookingLink: string;
    bookingUrl: string;
    qrCode?: string;
  } | null>(null);
  const [ownerBusinesses, setOwnerBusinesses] = useState<
    { salon_name: string; whatsapp_number: string }[] | null
  >(null);
  const [businessCategories, setBusinessCategories] = useState<{ value: string; label: string }[]>(
    BUSINESS_CATEGORIES_FALLBACK
  );

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
    if (!formData.location.trim() || formData.location.trim().length < 2) {
      return 'Location must be at least 2 characters';
    }
    if (!formData.address.trim() || formData.address.trim().length < 5) {
      return 'Address must be at least 5 characters';
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
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      const response = await fetch(API_ROUTES.SALONS, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify(formData),
      });
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        throw new Error(errorData.error || `Failed to create business (${response.status})`);
      }
      const result = await response.json();
      if (result.success && result.data) {
        setSuccess({
          bookingLink: result.data.booking_link,
          bookingUrl: result.data.booking_url,
          qrCode: result.data.qr_code || undefined,
        });
        try {
          const { clearUserStateCache, getUserState } = await import('@/lib/utils/user-state');
          clearUserStateCache();
          const ts = Date.now().toString();
          localStorage.setItem('business_created', ts);
          localStorage.setItem('user_state_changed', ts);
          window.dispatchEvent(new Event('businessCreated'));
          window.dispatchEvent(new Event('userStateChanged'));
          if (sessionUser) await getUserState(sessionUser.id, { skipCache: true });
        } catch (e) {
          console.warn('[SETUP] Could not notify other tabs:', e);
        }
        router.push(ROUTES.OWNER_DASHBOARD(result.data.booking_link));
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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (success) {
    const successContent = (
      <>
        <div className="text-center mb-6 md:mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 md:w-24 md:h-24 bg-green-100 rounded-full mb-4 md:mb-6 animate-pulse">
            <svg
              className="w-10 h-10 md:w-12 md:h-12 text-green-600"
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
          <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
            🎉 Business Created Successfully!
          </h2>
          <p className="text-sm md:text-base text-gray-600">
            Your booking page is ready to share with customers
          </p>
        </div>
        <div className="space-y-4 md:space-y-6">
          <div className="bg-gradient-to-r from-gray-50 to-gray-100 border-2 border-gray-300 rounded-xl p-4 md:p-6">
            <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
              <svg
                className="w-5 h-5 text-gray-700"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
                />
              </svg>
              Your Booking Link
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={success.bookingUrl}
                readOnly
                className="flex-1 px-4 py-3 border-2 border-gray-300 rounded-lg bg-white text-sm font-mono focus:ring-2 focus:ring-black focus:border-black"
              />
              <button
                onClick={() => {
                  copyToClipboard(success.bookingUrl);
                  alert('Booking link copied to clipboard!');
                }}
                className="px-6 py-3 bg-black text-white rounded-lg hover:bg-gray-900 transition-all text-sm font-semibold whitespace-nowrap shadow-md hover:shadow-lg"
              >
                Copy Link
              </button>
            </div>
          </div>
          {success.qrCode && (
            <div className="bg-white border-2 border-gray-300 rounded-xl p-4 md:p-6">
              <h3 className="flex items-center gap-2 text-lg font-semibold text-gray-900 mb-3">
                QR Code
              </h3>
              <div className="flex flex-col items-center space-y-5">
                <div className="bg-white p-5 rounded-xl border-2 border-gray-200 shadow-md relative w-48 h-48">
                  <Image
                    src={success.qrCode}
                    alt="QR Code"
                    fill
                    className="object-contain"
                    unoptimized
                  />
                </div>
                <button
                  onClick={() => {
                    if (!success.qrCode) return;
                    const link = document.createElement('a');
                    link.href = success.qrCode!;
                    link.download = `${success.bookingLink}-qr-code.png`;
                    document.body.appendChild(link);
                    link.click();
                    document.body.removeChild(link);
                  }}
                  className="w-full bg-black text-white font-semibold py-3 px-6 rounded-xl hover:bg-gray-900 transition-all"
                >
                  Download QR Code
                </button>
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-3">
            <Link href={getOwnerDashboardUrl(success.bookingLink)} className="flex-1">
              <button className="w-full bg-black text-white font-semibold py-3 px-6 rounded-xl hover:bg-gray-900">
                Go to Dashboard
              </button>
            </Link>
            <Link href={redirectAfterSuccess} className="flex-1">
              <button className="w-full bg-gray-200 text-gray-800 font-semibold py-3 px-6 rounded-xl hover:bg-gray-300">
                All Businesses
              </button>
            </Link>
          </div>
        </div>
      </>
    );
    if (embedded) {
      return (
        <div className="bg-white border border-gray-200 rounded-lg p-6 md:p-8">
          {successContent}
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-white flex">
        <div className="flex-1">
          <div className="mx-auto max-w-4xl px-2 py-6 sm:px-6 lg:px-8">
            {showOnboardingProgress && (
              <OnboardingProgress
                currentStep={3}
                totalSteps={3}
                steps={['Choose Role', 'Sign In', 'Create Business']}
              />
            )}
            <div className="bg-white rounded-2xl shadow-xl p-6 md:p-2 mt-4">{successContent}</div>
          </div>
        </div>
      </div>
    );
  }

  const inputClass =
    'w-full px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:ring-2 focus:ring-slate-400 focus:border-slate-400';
  const labelClass = 'block text-sm font-medium text-slate-700 mb-1';

  const formContentSimple = (
    <form onSubmit={handleSubmit} className="space-y-4">
      <p className="text-sm text-slate-500 mb-4">
        You can add more businesses later; each gets its own booking link and QR code.
      </p>
      <div>
        <label htmlFor="salon_name" className={labelClass}>
          Business name <span className="text-red-500">*</span>
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
          className={inputClass}
          placeholder="e.g. Elite Salon"
        />
      </div>
      <div>
        <label htmlFor="category" className={labelClass}>
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
          className={inputClass}
        >
          {businessCategories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="owner_name" className={labelClass}>
          Owner name <span className="text-red-500">*</span>
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
          className={inputClass}
          placeholder="e.g. John Doe"
        />
      </div>
      <div>
        <label htmlFor="whatsapp_number" className={labelClass}>
          WhatsApp number <span className="text-red-500">*</span>
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
          className={inputClass}
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
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="opening_time" className={labelClass}>
            Opening time <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            id="opening_time"
            name="opening_time"
            value={formData.opening_time.substring(0, 5)}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="closing_time" className={labelClass}>
            Closing time <span className="text-red-500">*</span>
          </label>
          <input
            type="time"
            id="closing_time"
            name="closing_time"
            value={formData.closing_time.substring(0, 5)}
            onChange={handleChange}
            required
            className={inputClass}
          />
        </div>
      </div>
      <div>
        <label htmlFor="slot_duration" className={labelClass}>
          Appointment duration <span className="text-red-500">*</span>
        </label>
        <select
          id="slot_duration"
          name="slot_duration"
          value={formData.slot_duration}
          onChange={handleChange}
          required
          className={inputClass}
        >
          {SLOT_DURATIONS.map((d) => (
            <option key={d} value={d}>
              {d} min
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="location" className={labelClass}>
          City / area <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          id="location"
          name="location"
          value={formData.location}
          onChange={handleChange}
          required
          minLength={2}
          maxLength={100}
          className={inputClass}
          placeholder="e.g. Bangalore, Karnataka"
        />
      </div>
      <div>
        <label htmlFor="address" className={labelClass}>
          Full address <span className="text-red-500">*</span>
        </label>
        <textarea
          id="address"
          name="address"
          value={formData.address}
          onChange={handleChange}
          required
          minLength={5}
          maxLength={500}
          rows={2}
          className={`${inputClass} resize-none`}
          placeholder="Street, city, state, PIN"
        />
      </div>
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          {error}
          {error.includes('/b/') && (
            <Link
              href={error.match(/\/b\/[^\s]+/)?.[0] || ROUTES.OWNER_DASHBOARD_BASE}
              className="mt-2 block font-medium underline"
            >
              Go to existing business →
            </Link>
          )}
        </div>
      )}
      <div className="flex flex-col gap-2 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        >
          {loading ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Creating…
            </>
          ) : (
            'Create business'
          )}
        </button>
      </div>
    </form>
  );

  const formContent = (
    <>
      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
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
            htmlFor="location"
            className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-2"
          >
            City / Area <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="location"
            name="location"
            value={formData.location}
            onChange={handleChange}
            required
            minLength={2}
            maxLength={100}
            className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black"
            placeholder="Bangalore, Karnataka"
          />
        </div>
        <div className="bg-gray-50 rounded-xl p-4 md:p-5 border border-gray-200">
          <label
            htmlFor="address"
            className="flex items-center gap-2 text-xs md:text-sm font-semibold text-gray-900 mb-2"
          >
            Full Address <span className="text-red-500">*</span>
          </label>
          <textarea
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            required
            minLength={5}
            maxLength={500}
            rows={3}
            className="w-full px-3 md:px-4 py-2.5 md:py-3 text-sm md:text-base border-2 border-gray-300 rounded-lg bg-white focus:ring-2 focus:ring-black focus:border-black resize-none"
            placeholder="123 Main Street, Bangalore, Karnataka 560001"
          />
        </div>
        {error && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-lg p-4">
            <p className="text-red-800 font-medium">{error}</p>
            {error.includes('/b/') && (
              <Link
                href={error.match(/\/b\/[^\s]+/)?.[0] || ROUTES.OWNER_DASHBOARD_BASE}
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
              className="w-full text-gray-600 hover:text-gray-900 text-xs md:text-sm disabled:opacity-50 font-medium"
            >
              Already have a business? Go to Dashboard →
            </button>
          </Link>
        </div>
      </form>
    </>
  );

  if (embedded) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6">{formContentSimple}</div>
    );
  }
  return (
    <div className="min-h-screen bg-white flex">
      <div className="flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-2 pb-8">
          {showOnboardingProgress && (
            <OnboardingProgress
              currentStep={3}
              totalSteps={3}
              steps={['Choose Role', 'Sign In', 'Create Business']}
            />
          )}
          <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8">{formContent}</div>
        </div>
      </div>
    </div>
  );
}
