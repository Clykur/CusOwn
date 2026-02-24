'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { API_ROUTES, ERROR_MESSAGES, SLOT_DURATIONS, VALIDATION } from '@/config/constants';
import { Salon, Slot } from '@/types';
import { formatDate, formatTime } from '@/lib/utils/string';
import { handleApiError, logError } from '@/lib/utils/error-handler';
import AnalyticsDashboard from '@/components/analytics/analytics-dashboard';
import { getCSRFToken } from '@/lib/utils/csrf-client';
import { supabaseAuth } from '@/lib/supabase/auth';
import { Toast } from '@/components/ui/toast';

export default function OwnerDashboardPage() {
  const params = useParams();
  const router = useRouter();
  const bookingLink = params.bookingLink as string;
  const [salon, setSalon] = useState<Salon | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'slots' | 'downtime' | 'analytics'>('slots');
  const [holidays, setHolidays] = useState<any[]>([]);
  const [closures, setClosures] = useState<any[]>([]);
  const [newHolidayDate, setNewHolidayDate] = useState('');
  const [newHolidayName, setNewHolidayName] = useState('');
  const [newClosureStart, setNewClosureStart] = useState('');
  const [newClosureEnd, setNewClosureEnd] = useState('');
  const [newClosureReason, setNewClosureReason] = useState('');
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    salon_name: '',
    owner_name: '',
    whatsapp_number: '',
    opening_time: '',
    closing_time: '',
    slot_duration: 30,
    address: '',
    location: '',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    // Pre-fetch CSRF token
    getCSRFToken().catch(console.error);
  }, []);

  // Auth: owner layout already verified session. API will return 401 if unauthenticated; we redirect only on 401 from fetchSalon.

  // Handle tab visibility changes - refresh data when tab becomes visible
  useEffect(() => {
    let refreshTimeout: NodeJS.Timeout | null = null;
    let isRefreshing = false;
    let lastRefreshTime = 0;
    const MIN_REFRESH_INTERVAL = 2000; // Don't refresh more than once per 2 seconds

    const refreshData = () => {
      const now = Date.now();
      if (isRefreshing || now - lastRefreshTime < MIN_REFRESH_INTERVAL) {
        return;
      }

      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(() => {
        isRefreshing = true;
        lastRefreshTime = Date.now();

        // Only refresh if tab is visible and salon is loaded
        if (typeof document !== 'undefined' && !document.hidden && salon) {
          const date = selectedDate || new Date().toISOString().split('T')[0];

          // Trigger re-fetch by updating a dependency or calling fetch functions
          // The useEffect for bookings/slots will handle the actual fetch
          setSelectedDate(date); // This will trigger the useEffect
        }

        isRefreshing = false;
      }, 500); // Debounce delay
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        refreshData();
      }
    };

    const handleFocus = () => {
      refreshData();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleFocus);

    return () => {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleFocus);
    };
  }, [salon, selectedDate]);

  useEffect(() => {
    if (!bookingLink) return;

    const fetchSalon = async () => {
      try {
        // Extract token from URL if present (for secure access)
        const urlParams = new URLSearchParams(window.location.search);
        const token = urlParams.get('token');

        // Build URL with token if available
        let url = `${API_ROUTES.SALONS}/${bookingLink}`;
        if (token) {
          url += `?token=${encodeURIComponent(token)}`;
        }

        // Auth: credentials: 'include' sends cookies; server getServerUser() validates. Optionally add Bearer if Supabase session exists.
        const headers: HeadersInit = {};
        if (supabaseAuth) {
          const {
            data: { session },
          } = await supabaseAuth.auth.getSession();
          if (session?.access_token) {
            headers['Authorization'] = `Bearer ${session.access_token}`;
          }
        }

        const response = await fetch(url, {
          headers,
          credentials: 'include',
        });
        const result = await response.json();

        if (!response.ok) {
          // Handle authentication/authorization errors
          if (response.status === 401) {
            // Not authenticated - redirect to landing (middleware will handle)
            window.location.href = '/auth/login';
            return;
          }
          if (response.status === 403) {
            // Access denied - redirect to owner dashboard
            window.location.href = '/owner/dashboard';
            return;
          }

          // If token is missing and it's a UUID, try to generate secure URL
          if (
            response.status === 403 &&
            !token &&
            /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(bookingLink)
          ) {
            try {
              const { getSecureOwnerDashboardUrlClient } = await import('@/lib/utils/navigation');
              const secureUrl = await getSecureOwnerDashboardUrlClient(bookingLink);
              // Redirect to secure URL
              window.location.href = secureUrl;
              return;
            } catch (urlError) {
              console.error('Failed to generate secure URL:', urlError);
            }
          }
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
                setSalon((prev) => (prev ? { ...prev, qr_code: qrResult.data.qr_code } : null));
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

  // Fetch slots for this salon when salon/date changes. Auth via cookies (credentials: 'include') or optional Bearer.
  const fetchSlots = useCallback(async () => {
    if (!salon) return;
    if (typeof document !== 'undefined' && document.hidden) return;
    try {
      const date = selectedDate || new Date().toISOString().split('T')[0];
      const headers: HeadersInit = {};
      if (supabaseAuth) {
        const {
          data: { session },
        } = await supabaseAuth.auth.getSession();
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
      }
      const response = await fetch(`${API_ROUTES.SLOTS}?salon_id=${salon.id}&date=${date}`, {
        headers,
        credentials: 'include',
      });
      const result = await response.json();
      if (result.success && result.data) setSlots(result.data);
    } catch (err) {
      logError(err, 'Slots Fetch');
    }
  }, [salon, selectedDate]);

  useEffect(() => {
    if (!salon) return;
    fetchSlots();
  }, [salon, selectedDate, fetchSlots]);

  // Fetch downtime function - can be called from multiple places
  const fetchDowntime = useCallback(async () => {
    if (!salon) return;

    // Don't fetch if tab is hidden
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    try {
      const [holidaysRes, closuresRes] = await Promise.all([
        fetch(`/api/businesses/${salon.id}/downtime/holidays`, { credentials: 'include' }),
        fetch(`/api/businesses/${salon.id}/downtime/closures`, { credentials: 'include' }),
      ]);

      // Check if tab is still visible before processing
      if (typeof document !== 'undefined' && document.hidden) {
        return;
      }

      const holidaysData = await holidaysRes.json();
      const closuresData = await closuresRes.json();
      if (holidaysData.success) setHolidays(holidaysData.data || []);
      if (closuresData.success) setClosures(closuresData.data || []);
    } catch (err: any) {
      // Only log errors if tab is visible
      if (typeof document !== 'undefined' && !document.hidden) {
        console.error('Failed to fetch downtime:', err);
      }
    }
  }, [salon]);

  // Fetch downtime when salon changes or tab becomes visible
  useEffect(() => {
    if (!salon) return;

    // Don't fetch if tab is hidden
    if (typeof document !== 'undefined' && document.hidden) {
      return;
    }

    fetchDowntime();
  }, [salon, fetchDowntime]);

  // Bookings actions removed: bookings have been migrated to owner dashboard

  const handleAddHoliday = async () => {
    if (!newHolidayDate || !salon) return;
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      const response = await fetch(`/api/businesses/${salon.id}/downtime/holidays`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ holiday_date: newHolidayDate, holiday_name: newHolidayName }),
      });
      if (response.ok) {
        setNewHolidayDate('');
        setNewHolidayName('');
        fetchDowntime();
      }
    } catch (err) {
      alert('Failed to add holiday');
    }
  };

  const handleAddClosure = async () => {
    if (!newClosureStart || !newClosureEnd || !salon) return;
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }
      const response = await fetch(`/api/businesses/${salon.id}/downtime/closures`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          start_date: newClosureStart,
          end_date: newClosureEnd,
          reason: newClosureReason,
        }),
      });
      if (response.ok) {
        setNewClosureStart('');
        setNewClosureEnd('');
        setNewClosureReason('');
        fetchDowntime();
      }
    } catch (err) {
      alert('Failed to add closure');
    }
  };

  const openEditModal = () => {
    if (!salon) return;
    setEditForm({
      salon_name: salon.salon_name,
      owner_name: salon.owner_name,
      whatsapp_number: salon.whatsapp_number
        .replace(/\D/g, '')
        .slice(0, VALIDATION.WHATSAPP_NUMBER_MAX_LENGTH),
      opening_time: salon.opening_time?.substring(0, 5) ?? '10:00',
      closing_time: salon.closing_time?.substring(0, 5) ?? '21:00',
      slot_duration: salon.slot_duration ?? 30,
      address: salon.address ?? '',
      location: salon.location ?? '',
    });
    setEditError(null);
    setEditModalOpen(true);
  };

  const handleEditSave = async () => {
    if (!salon || !bookingLink) return;
    setEditSaving(true);
    setEditError(null);
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      const res = await fetch(`/api/owner/businesses/${encodeURIComponent(bookingLink)}`, {
        method: 'PATCH',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          salon_name: editForm.salon_name.trim(),
          owner_name: editForm.owner_name.trim(),
          whatsapp_number: editForm.whatsapp_number,
          opening_time:
            editForm.opening_time.length === 5
              ? `${editForm.opening_time}:00`
              : editForm.opening_time,
          closing_time:
            editForm.closing_time.length === 5
              ? `${editForm.closing_time}:00`
              : editForm.closing_time,
          slot_duration: editForm.slot_duration,
          address: editForm.address.trim(),
          location: editForm.location.trim(),
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        setEditError(json.error || ERROR_MESSAGES.UNEXPECTED_ERROR);
        return;
      }
      if (json.success && json.data) {
        setSalon(json.data);
        setEditModalOpen(false);
        setToastMessage('Business updated successfully');
      }
    } catch (err) {
      setEditError(err instanceof Error ? err.message : ERROR_MESSAGES.UNEXPECTED_ERROR);
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!salon || !bookingLink) return;
    if (!window.confirm('Are you sure you want to delete this business? This cannot be undone.')) {
      return;
    }
    setDeleteSaving(true);
    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {};
      if (csrfToken) headers['x-csrf-token'] = csrfToken;
      const res = await fetch(`/api/owner/businesses/${encodeURIComponent(bookingLink)}`, {
        method: 'DELETE',
        headers,
        credentials: 'include',
      });
      const json = await res.json();
      if (res.ok && json.success) {
        router.push('/owner/businesses?deleted=1');
        return;
      }
      setError(json.error || 'Failed to delete business');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete business');
    } finally {
      setDeleteSaving(false);
    }
  };

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

  if (loading) {
    return (
      <div className="w-full pb-24 flex flex-col gap-6">
        <div className="h-8 bg-slate-200 rounded w-64 mb-2 animate-pulse" />
        <div className="h-4 bg-slate-200 rounded w-48 animate-pulse" />
        <div className="bg-white border border-slate-200 rounded-lg p-6 animate-pulse">
          <div className="h-48 bg-slate-200 rounded mb-4" />
          <div className="h-6 bg-slate-200 rounded w-3/4 mb-2" />
          <div className="h-4 bg-slate-200 rounded w-1/2" />
        </div>
      </div>
    );
  }

  if (error || !salon) {
    return (
      <div className="w-full pb-24">
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">Access Denied</h2>
          <p className="text-slate-600 mb-8">Invalid booking link or salon not found.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full pb-24 flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <Link
          href="/owner/businesses"
          className="lg:hidden flex items-center justify-center p-2 -ml-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <svg
            className="w-6 h-6 text-gray-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </Link>

        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 truncate leading-tight">
          {salon.salon_name}
        </h1>
      </div>
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col sm:flex-row gap-6 items-center sm:items-start">
          <div className="flex-shrink-0">
            {salon.qr_code ? (
              <div className="flex justify-center bg-white p-3 lg:p-4 rounded-lg border-2 border-gray-200 relative w-40 h-40 lg:w-48 lg:h-48">
                <Image
                  src={salon.qr_code}
                  alt="QR Code"
                  fill
                  className="object-contain"
                  unoptimized
                />
              </div>
            ) : (
              <div className="w-40 h-40 lg:w-48 lg:h-48 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-gray-200">
                <p className="text-gray-500 text-sm">Generating...</p>
              </div>
            )}
          </div>
          <div className="flex-1 text-center md:text-left w-full md:w-auto">
            <h2 className="text-lg lg:text-xl font-bold text-gray-900 mb-2">QR Code</h2>
            <p className="text-sm text-gray-600 mb-4">
              Download and keep it safe. Stick it in your shop for customers to scan and book.
            </p>
            {salon.qr_code && (
              <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                <button
                  onClick={downloadQRCode}
                  className="h-11 px-6 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                    />
                  </svg>
                  Download QR Code
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Business details – owner CRUD */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 sm:p-5 lg:p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-4">
          <h2 className="text-lg font-semibold text-slate-900">Business details</h2>
          <div className="flex gap-3">
            <button
              type="button"
              onClick={openEditModal}
              className="px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50 transition-colors"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteSaving}
              className="px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {deleteSaving ? 'Deleting...' : 'Delete'}
            </button>
          </div>
        </div>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
          <div>
            <dt className="text-slate-500">Business name</dt>
            <dd className="font-medium text-slate-900">{salon.salon_name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Owner name</dt>
            <dd className="font-medium text-slate-900">{salon.owner_name}</dd>
          </div>
          <div>
            <dt className="text-slate-500">WhatsApp</dt>
            <dd className="font-medium text-slate-900">{salon.whatsapp_number}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Hours</dt>
            <dd className="font-medium text-slate-900">
              {salon.opening_time?.substring(0, 5)} – {salon.closing_time?.substring(0, 5)}
            </dd>
          </div>
          <div>
            <dt className="text-slate-500">Slot duration</dt>
            <dd className="font-medium text-slate-900">{salon.slot_duration} min</dd>
          </div>
          {salon.location && (
            <div>
              <dt className="text-slate-500">Location</dt>
              <dd className="font-medium text-slate-900">{salon.location}</dd>
            </div>
          )}
          {salon.address && (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Address</dt>
              <dd className="font-medium text-slate-900">{salon.address}</dd>
            </div>
          )}
        </dl>
      </div>

      {/* Edit business modal – blurred backdrop */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white rounded-xl shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto p-6">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Edit business</h3>
            {editError && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 text-red-800 text-sm">{editError}</div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Business name *
                </label>
                <input
                  type="text"
                  value={editForm.salon_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, salon_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  maxLength={VALIDATION.SALON_NAME_MAX_LENGTH}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Owner name *
                </label>
                <input
                  type="text"
                  value={editForm.owner_name}
                  onChange={(e) => setEditForm((f) => ({ ...f, owner_name: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  maxLength={VALIDATION.OWNER_NAME_MAX_LENGTH}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  WhatsApp number * (10 digits)
                </label>
                <input
                  type="tel"
                  value={editForm.whatsapp_number}
                  onChange={(e) => {
                    const digits = e.target.value
                      .replace(/\D/g, '')
                      .slice(0, VALIDATION.WHATSAPP_NUMBER_MAX_LENGTH);
                    setEditForm((f) => ({ ...f, whatsapp_number: digits }));
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  placeholder="10 digits"
                  inputMode="numeric"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Opening time
                  </label>
                  <input
                    type="time"
                    value={editForm.opening_time}
                    onChange={(e) => setEditForm((f) => ({ ...f, opening_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Closing time
                  </label>
                  <input
                    type="time"
                    value={editForm.closing_time}
                    onChange={(e) => setEditForm((f) => ({ ...f, closing_time: e.target.value }))}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Slot duration (min)
                </label>
                <select
                  value={editForm.slot_duration}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, slot_duration: Number(e.target.value) }))
                  }
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                >
                  {SLOT_DURATIONS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Location / City
                </label>
                <input
                  type="text"
                  value={editForm.location}
                  onChange={(e) => setEditForm((f) => ({ ...f, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent"
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
                <textarea
                  value={editForm.address}
                  onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))}
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-slate-900 focus:border-transparent resize-none"
                  maxLength={VALIDATION.ADDRESS_MAX_LENGTH}
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setEditModalOpen(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditSave}
                disabled={
                  editSaving ||
                  !editForm.salon_name.trim() ||
                  !editForm.owner_name.trim() ||
                  editForm.whatsapp_number.length !== VALIDATION.WHATSAPP_NUMBER_MIN_LENGTH
                }
                className="flex-1 px-4 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {editSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {toastMessage && <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />}

      {/* Tabs Section - Mobile Scrollable */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="flex gap-1 bg-slate-100 p-1 border-b border-slate-200 overflow-x-auto">
          {/* Bookings tab removed from per-salon page; moved to owner dashboard */}
          <button
            onClick={() => setActiveTab('slots')}
            className={`flex-shrink-0 px-4 py-3 font-semibold rounded-md transition-all duration-200 whitespace-nowrap ${
              activeTab === 'slots'
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Slots
          </button>
          <button
            onClick={() => setActiveTab('downtime')}
            className={`flex-shrink-0 px-4 py-3 font-semibold rounded-md transition-all duration-200 whitespace-nowrap ${
              activeTab === 'downtime'
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Downtime
          </button>
          <button
            onClick={() => setActiveTab('analytics')}
            className={`flex-shrink-0 px-4 py-3 font-semibold rounded-md transition-all duration-200 whitespace-nowrap ${
              activeTab === 'analytics'
                ? 'bg-white text-black shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Analytics
          </button>
        </div>

        <div className={`${activeTab === 'analytics' ? 'p-4 sm:p-6' : 'p-4 lg:p-6'}`}>
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Date</label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="w-full sm:w-64 lg:w-72 h-10 sm:h-11 px-3 sm:px-4 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent"
            />
          </div>

          {/* Bookings removed from per-salon page. */}
          {activeTab === 'slots' ? (
            /* Slots Tab - Mobile Vertical / Desktop Kanban Board */
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {/* Available Column */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Available
                  </h3>
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                    {slots.filter((s) => s.status === 'available').length}
                  </span>
                </div>
                <div className="space-y-2 max-h-[400px] lg:max-h-[600px] overflow-y-auto">
                  {slots.filter((s) => s.status === 'available').length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">No available slots</p>
                    </div>
                  ) : (
                    slots
                      .filter((s) => s.status === 'available')
                      .map((slot) => (
                        <div
                          key={slot.id}
                          className="bg-white border-2 border-gray-200 rounded-lg p-3 hover:border-gray-300 transition-colors"
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Reserved Column */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Reserved
                  </h3>
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                    {slots.filter((s) => s.status === 'reserved').length}
                  </span>
                </div>
                <div className="space-y-2 max-h-[400px] lg:max-h-[600px] overflow-y-auto">
                  {slots.filter((s) => s.status === 'reserved').length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">No reserved slots</p>
                    </div>
                  ) : (
                    slots
                      .filter((s) => s.status === 'reserved')
                      .map((slot) => (
                        <div
                          key={slot.id}
                          className="bg-white border-2 border-gray-400 rounded-lg p-3 hover:border-gray-500 transition-colors"
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>

              {/* Booked Column */}
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">
                    Booked
                  </h3>
                  <span className="text-xs text-gray-500 bg-white px-2 py-1 rounded-full">
                    {slots.filter((s) => s.status === 'booked').length}
                  </span>
                </div>
                <div className="space-y-2 max-h-[400px] lg:max-h-[600px] overflow-y-auto">
                  {slots.filter((s) => s.status === 'booked').length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-sm text-gray-500">No booked slots</p>
                    </div>
                  ) : (
                    slots
                      .filter((s) => s.status === 'booked')
                      .map((slot) => (
                        <div
                          key={slot.id}
                          className="bg-gray-50 border-2 border-black rounded-lg p-3"
                        >
                          <div className="text-sm font-medium text-gray-900">
                            {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                          </div>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === 'downtime' ? (
            <div className="space-y-6">
              <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Holidays</h3>
                <div className="space-y-3 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Holiday Date
                    </label>
                    <input
                      type="date"
                      value={newHolidayDate}
                      onChange={(e) => setNewHolidayDate(e.target.value)}
                      className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Holiday Name (Optional)
                    </label>
                    <input
                      type="text"
                      value={newHolidayName}
                      onChange={(e) => setNewHolidayName(e.target.value)}
                      className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-base"
                      placeholder="e.g., New Year"
                    />
                  </div>
                  <button
                    onClick={handleAddHoliday}
                    disabled={!newHolidayDate}
                    className="w-full h-11 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add Holiday
                  </button>
                </div>
                {holidays.length > 0 && (
                  <div className="space-y-2">
                    {holidays.map((holiday) => (
                      <div
                        key={holiday.id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatDate(holiday.holiday_date)}
                          </p>
                          {holiday.holiday_name && (
                            <p className="text-sm text-gray-600">{holiday.holiday_name}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="bg-white border border-gray-200 rounded-lg p-4 lg:p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Closures</h3>
                <div className="space-y-3 mb-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Start Date
                    </label>
                    <input
                      type="date"
                      value={newClosureStart}
                      onChange={(e) => setNewClosureStart(e.target.value)}
                      className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">End Date</label>
                    <input
                      type="date"
                      value={newClosureEnd}
                      onChange={(e) => setNewClosureEnd(e.target.value)}
                      className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-base"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Reason (Optional)
                    </label>
                    <input
                      type="text"
                      value={newClosureReason}
                      onChange={(e) => setNewClosureReason(e.target.value)}
                      className="w-full h-11 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-black focus:border-transparent text-base"
                      placeholder="e.g., Maintenance"
                    />
                  </div>
                  <button
                    onClick={handleAddClosure}
                    disabled={!newClosureStart || !newClosureEnd}
                    className="w-full h-11 bg-black text-white font-semibold rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 4v16m8-8H4"
                      />
                    </svg>
                    Add Closure
                  </button>
                </div>
                {closures.length > 0 && (
                  <div className="space-y-2">
                    {closures.map((closure) => (
                      <div
                        key={closure.id}
                        className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                      >
                        <div>
                          <p className="font-medium text-gray-900">
                            {formatDate(closure.start_date)} - {formatDate(closure.end_date)}
                          </p>
                          {closure.reason && (
                            <p className="text-sm text-gray-600">{closure.reason}</p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="w-full">
              <AnalyticsDashboard businessId={salon.id} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
