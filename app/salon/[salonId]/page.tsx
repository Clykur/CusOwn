'use client';

import { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { API_ROUTES } from '@/config/constants';
import { Salon, Slot } from '@/types';
import { formatDate, formatTime, formatPhoneNumber } from '@/lib/utils/string';
import { isTimeInRange } from '@/lib/utils/time';
import { logError } from '@/lib/utils/error-handler';
import { ROUTES } from '@/lib/utils/navigation';
import { getCSRFToken, clearCSRFToken } from '@/lib/utils/csrf-client';
import { isValidUUID } from '@/lib/utils/security';
import { RedirectSkeleton } from '@/components/ui/skeleton';
import CheckIcon from '@/src/icons/check.svg';
import ChevronLeftIcon from '@/src/icons/chevron-left.svg';
import MapPinIcon from '@/src/icons/map-pin.svg';
import ProfileIcon from '@/src/icons/profile.svg';
import ClockIcon from '@/src/icons/clock.svg';
import BookingsIcon from '@/src/icons/bookings.svg';
import CloseIcon from '@/src/icons/close.svg';
import InfoIcon from '@/src/icons/info.svg';

export default function SalonDetailPage() {
  const params = useParams();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const salonId = typeof params?.salonId === 'string' ? params.salonId : '';
  const [salon, setSalon] = useState<Salon | null>(null);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [closedMessage, setClosedMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{ whatsappUrl?: string } | false>(false);
  const [nameError, setNameError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [touchedName, setTouchedName] = useState(false);
  const [touchedPhone, setTouchedPhone] = useState(false);

  useEffect(() => {
    // Fetch CSRF token on page load
    getCSRFToken().catch(console.error);
  }, []);

  useEffect(() => {
    if (!salonId) return;

    let isMounted = true;
    let retryCount = 0;
    const maxRetries = 2;

    const fetchSalon = async () => {
      try {
        // Check if salonId is a UUID or a booking_link
        const isUUID = isValidUUID(salonId);

        // Get token from URL params with proper decoding
        const tokenParam = searchParams?.get('token');
        let token = tokenParam ? decodeURIComponent(tokenParam) : null;

        // Only generate secure URLs for UUIDs (not booking links)
        if (isUUID && (!token || token === 'pending')) {
          // Try to generate a new secure URL for UUID
          try {
            const { getSecureSalonUrlClient } = await import('@/lib/utils/navigation');
            const secureUrl = await getSecureSalonUrlClient(salonId);
            if (secureUrl && secureUrl !== `/salon/${salonId}?token=pending`) {
              // Extract token from the secure URL before redirecting
              const urlMatch = secureUrl.match(/[?&]token=([^&]+)/);
              if (urlMatch) {
                token = decodeURIComponent(urlMatch[1]);
              }
              // Redirect to secure URL
              router.replace(secureUrl);
            }
          } catch (urlError) {
            console.error('Failed to generate secure URL:', urlError);
          }
        }

        // For UUIDs, token is required. For booking links, token is optional
        if (isUUID && (!token || token === 'pending')) {
          throw new Error('Access token is required. Please use a valid booking link.');
        }

        // Build API URL - include token only if it exists and is not 'pending'
        let apiUrl = `/api/salons/${salonId}`;
        if (token && token !== 'pending') {
          const encodedToken = encodeURIComponent(token);
          apiUrl += `?token=${encodedToken}`;
        }

        const response = await fetch(apiUrl, {
          credentials: 'include',
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          if (response.status === 403) {
            // If token is invalid and we haven't retried, try generating a new one (only for UUIDs)
            if (isUUID && retryCount < maxRetries) {
              retryCount++;
              try {
                const { getSecureSalonUrlClient } = await import('@/lib/utils/navigation');
                const secureUrl = await getSecureSalonUrlClient(salonId);
                if (secureUrl && secureUrl !== `/salon/${salonId}?token=pending`) {
                  router.push(secureUrl);
                  return;
                }
              } catch (retryError) {
                // Fall through to error
              }
            }
            throw new Error('Invalid access token. Please use a valid booking link.');
          }
          throw new Error(errorData.error || `Failed to load salon (${response.status})`);
        }

        const result = await response.json();

        if (!isMounted) return;

        if (result.success && result.data) {
          const data = result.data as Salon & { booking_link?: string };
          setSalon(data);
          setError(null);
          // Canonical booking entry: redirect to /b/[bookingLink] only (one mental model)
          if (data.booking_link) {
            const tokenParam = searchParams?.get('token');
            const q = tokenParam ? `?token=${encodeURIComponent(tokenParam)}` : '';
            router.replace(`/b/${data.booking_link}${q}`);
            return;
          }
        } else {
          throw new Error(result.error || 'Salon not found');
        }
      } catch (err) {
        if (!isMounted) return;
        console.error('Error fetching salon:', err);
        setError(err instanceof Error ? err.message : 'Failed to load salon');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchSalon();
    return () => {
      isMounted = false;
    };
  }, [salonId, searchParams, router]);

  useEffect(() => {
    if (!salon || !selectedDate) return;

    const fetchSlots = async () => {
      setLoadingSlots(true);
      setError(null);
      setSelectedSlot(null);
      setClosedMessage(null);
      try {
        const response = await fetch(
          `${API_ROUTES.SLOTS}?salon_id=${salon.id}&date=${selectedDate}`
        );

        if (!response.ok) {
          const errorData = await response
            .json()
            .catch(() => ({ error: `HTTP ${response.status}` }));
          const errorMessage = errorData.error || `Failed to load slots (${response.status})`;
          console.error('Slots API HTTP error:', {
            status: response.status,
            statusText: response.statusText,
            error: errorMessage,
            errorData,
          });
          setSlots([]);
          setError(errorMessage);
          return;
        }

        const result = await response.json();

        if (result.success && result.data) {
          // Detect server-side closed / holiday state
          if (result.data.closed) {
            setClosedMessage(result.data.message || 'Shop is closed on this day.');
            setSlots([]);
          } else {
            setClosedMessage(null);
            const slotsArr = Array.isArray(result.data) ? result.data : (result.data.slots ?? []);
            setSlots(slotsArr);
          }
        } else {
          const errorMessage = result.error || 'Failed to load slots';
          console.error('Slots API response error:', {
            error: errorMessage,
            success: result.success,
            data: result.data,
            fullResponse: JSON.stringify(result, null, 2),
          });
          setSlots([]);
          setError(errorMessage);
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Failed to load slots';
        console.error('Error fetching slots:', {
          error: err,
          message: errorMessage,
          stack: err instanceof Error ? err.stack : undefined,
        });
        logError(err, 'Slots Fetch');
        setSlots([]);
        setError(errorMessage);
      } finally {
        setLoadingSlots(false);
      }
    };

    fetchSlots();
  }, [salon, selectedDate]);

  useEffect(() => {
    setSelectedDate(getTodayDateString());
  }, []);

  const handleSlotSelect = (slot: Slot) => {
    if (slot.status === 'booked') return;
    setSelectedSlot(slot);
    setError(null);
  };

  const validateName = (name: string): string | null => {
    if (!name.trim()) {
      return 'Name is required';
    }
    if (name.trim().length < 2) {
      return 'Name must be at least 2 characters';
    }
    if (name.trim().length > 100) {
      return 'Name must be less than 100 characters';
    }
    return null;
  };

  const validatePhone = (phone: string): string | null => {
    if (!phone.trim()) {
      return 'Phone number is required';
    }
    const cleaned = phone.replace(/\s/g, '');
    if (!/^\+?[1-9]\d{9,14}$/.test(cleaned)) {
      return 'Please enter a valid phone number';
    }
    return null;
  };

  const handleNameChange = (value: string) => {
    setCustomerName(value);
    setError(null);
    if (touchedName) {
      setNameError(validateName(value));
    }
  };

  const handlePhoneChange = (value: string) => {
    const cleaned = value.replace(/\D/g, '');
    let formatted = cleaned;

    if (cleaned.length > 0 && !cleaned.startsWith('+')) {
      if (cleaned.length <= 10) {
        formatted = cleaned;
      } else if (cleaned.startsWith('91') && cleaned.length === 12) {
        formatted = `+${cleaned}`;
      } else {
        formatted = `+91${cleaned.slice(-10)}`;
      }
    }

    setCustomerPhone(formatted);
    setError(null);
    if (touchedPhone) {
      setPhoneError(validatePhone(formatted));
    }
  };

  const handleBookSlot = async () => {
    if (!selectedSlot || !salon) {
      setError('Please select a time slot');
      return;
    }

    setTouchedName(true);
    setTouchedPhone(true);

    const nameErr = validateName(customerName);
    const phoneErr = validatePhone(customerPhone);

    setNameError(nameErr);
    setPhoneError(phoneErr);

    if (nameErr || phoneErr) {
      setError(nameErr || phoneErr || 'Please fill in all required fields');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      const csrfToken = await getCSRFToken();
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const response = await fetch(API_ROUTES.BOOKINGS, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({
          salon_id: salon.id,
          slot_id: selectedSlot.id,
          customer_name: customerName.trim(),
          customer_phone: formatPhoneNumber(customerPhone.trim()),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
        const errorMessage = errorData.error || `Failed to create booking (${response.status})`;
        console.error('Booking API error:', {
          status: response.status,
          statusText: response.statusText,
          error: errorMessage,
          errorData,
        });
        throw new Error(errorMessage);
      }

      const result = await response.json();

      if (result.success && result.data) {
        setSuccess({ whatsappUrl: result.data.whatsapp_url });
        // Optimistically mark the booked slot as unavailable
        if (selectedSlot) {
          setSlots((prev) =>
            prev.map((s) => (s.id === selectedSlot.id ? { ...s, status: 'booked' as const } : s))
          );
          setSelectedSlot(null);
        }
        if (result.data.whatsapp_url) {
          setTimeout(() => {
            window.open(result.data.whatsapp_url, '_blank');
          }, 500);
        } else {
          console.warn('No WhatsApp URL in response:', result.data);
          setError(
            'Booking created but WhatsApp URL is missing. Please contact the salon directly.'
          );
        }
      } else {
        const errorMessage = result.error || 'Failed to create booking';
        console.error('Booking response error:', {
          success: result.success,
          error: errorMessage,
          data: result.data,
        });
        throw new Error(errorMessage);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred';
      console.error('Booking error:', {
        error: err,
        message: errorMessage,
        stack: err instanceof Error ? err.stack : undefined,
      });
      setError(errorMessage);
      clearCSRFToken(); // Clear token on error to force refresh
    } finally {
      setSubmitting(false);
    }
  };

  const getTodayDateString = (): string => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const availableDates = useMemo(() => {
    const dates = [];
    const today = new Date();

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(today.getDate() + i);
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      dates.push(`${year}-${month}-${day}`);
    }
    return dates;
  }, []);

  const availableSlots = useMemo(() => {
    return slots.filter((s) => s.status === 'available');
  }, [slots]);

  const bookedSlots = useMemo(() => {
    return slots.filter((s) => s.status === 'booked');
  }, [slots]);

  if (loading) {
    return <RedirectSkeleton />;
  }

  if (error && !salon) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Salon Not Found</h2>
          <p className="text-gray-600 mb-8">{error}</p>
          <Link href={ROUTES.SALON_LIST}>
            <Button>Back to Salons</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (!salon) return null;

  // Canonical booking: do not show form on /salon; redirect to /b/[bookingLink] only
  if ((salon as Salon & { booking_link?: string }).booking_link) {
    return (
      <>
        <RedirectSkeleton />
        <p className="sr-only" aria-live="polite">
          Redirecting to booking page…
        </p>
      </>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-white flex">
        <div className="flex-1 lg:ml-64 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 text-center border-2 border-gray-200">
            <div className="mb-6">
              <div className="mx-auto flex items-center justify-center h-20 w-20 rounded-full bg-green-100 mb-4 animate-pulse">
                <CheckIcon className="h-10 w-10 text-green-600" aria-hidden="true" />
              </div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Booking Request Sent!</h2>
              <p className="text-gray-600 mb-1">
                Your booking request has been sent to{' '}
                <span className="font-semibold">{salon.salon_name}</span>.
              </p>
              <p className="text-sm text-gray-500">
                Check WhatsApp for confirmation from the salon owner.
              </p>
            </div>
            <div className="space-y-3">
              {success.whatsappUrl && (
                <Button
                  onClick={() => window.open(success.whatsappUrl, '_blank')}
                  size="lg"
                  className="w-full bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-bold py-6 shadow-lg hover:shadow-xl"
                >
                  <span className="flex items-center justify-center gap-2">
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.867-.272 0-.372.149-.372.297 0 .343.396.416.785.57.39.153 1.562.724 1.808.867.247.144.38.223.38.446 0 .223-.297.372-.594.521-.297.15-1.758.867-2.03.867-.272 0-.372-.15-.372-.297 0-.343.396-.416.785-.57.39-.153 1.562-.724 1.808-.867.247-.144.38-.223.38-.446 0-.223-.297-.372-.594-.521zm-4.5-2.67c-.297-.15-1.758-.867-2.03-.867-.272 0-.372.15-.372.297 0 .343.396.416.785.57.39.153 1.562.724 1.808.867.247.144.38.223.38.446 0 .223-.297.372-.594.521-.297.15-1.758.867-2.03.867-.272 0-.372-.15-.372-.297 0-.343.396-.416.785-.57.39-.153 1.562-.724 1.808-.867.247-.144.38-.223.38-.446 0-.223-.297-.372-.594-.521zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 17.308c-.149.297-.446.446-.744.446-.149 0-.297-.05-.446-.149l-1.758-1.008c-.297-.149-.446-.446-.446-.744v-2.67c0-.297.149-.594.446-.744l1.758-1.008c.149-.1.297-.149.446-.149.297 0 .594.149.744.446.149.297.149.594 0 .892l-1.758 1.008v1.116l1.758 1.008c.149.297.149.594 0 .892z" />
                    </svg>
                    Open WhatsApp
                  </span>
                </Button>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Link href={ROUTES.CUSTOMER_DASHBOARD}>
                  <Button variant="outline" size="lg" className="w-full border-2">
                    My Bookings
                  </Button>
                </Link>
                <Link href={ROUTES.SALON_LIST}>
                  <Button variant="outline" size="lg" className="w-full border-2">
                    Browse More
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white flex">
      <div className="flex-1 lg:ml-64">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <Link
              href={ROUTES.SALON_LIST}
              className="inline-flex items-center gap-2 text-gray-600 hover:text-black transition-colors font-medium"
            >
              <ChevronLeftIcon className="w-5 h-5" aria-hidden="true" />
              Back to Salons
            </Link>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6 md:p-8 mb-6 border border-gray-200">
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
                <div className="flex-1">
                  <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-3">
                    {salon.salon_name}
                  </h1>
                  {salon.location && (
                    <div className="flex items-center gap-2 text-gray-600 mb-2">
                      <MapPinIcon className="w-4 h-4" aria-hidden="true" />
                      <span className="text-sm font-medium">{salon.location}</span>
                    </div>
                  )}
                  {salon.owner_name && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <ProfileIcon className="w-4 h-4" aria-hidden="true" />
                      <span className="text-sm">Owner: {salon.owner_name}</span>
                    </div>
                  )}
                </div>
              </div>

              {salon.address && (
                <div className="bg-gray-50 rounded-lg p-4 mb-4">
                  <div className="flex items-start gap-3">
                    <MapPinIcon
                      className="w-5 h-5 text-gray-500 mt-0.5 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-gray-900 font-semibold text-sm mb-1">Address</p>
                      <p className="text-sm text-gray-600">{salon.address}</p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-gray-200">
                {salon.opening_time && salon.closing_time && (
                  <div className="flex items-center gap-2 text-sm">
                    <ClockIcon className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden="true" />
                    <span className="text-gray-700">
                      <span className="font-medium">Hours:</span>{' '}
                      {salon.opening_time.substring(0, 5)} - {salon.closing_time.substring(0, 5)}
                    </span>
                  </div>
                )}
                {salon.slot_duration && (
                  <div className="flex items-center gap-2 text-sm">
                    <ClockIcon className="w-4 h-4 text-gray-500 flex-shrink-0" aria-hidden="true" />
                    <span className="text-gray-700">
                      <span className="font-medium">Duration:</span> {salon.slot_duration} min
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-md p-6 md:p-8 border border-gray-200">
            <div className="mb-6">
              <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">
                Book Your Appointment
              </h2>
              <p className="text-gray-600 text-sm">
                Select a date and time slot to book your appointment
              </p>
            </div>

            <div className="mb-6 bg-gray-50 rounded-xl p-5 border border-gray-200">
              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-4">
                <BookingsIcon className="w-4 h-4 text-gray-600" aria-hidden="true" />
                Select Date
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-2">
                {availableDates.map((date) => {
                  const dateObj = new Date(date + 'T00:00:00');
                  const isToday = date === getTodayDateString();
                  const isSelected = selectedDate === date;
                  const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                  const dayNum = dateObj.getDate();
                  const month = dateObj.toLocaleDateString('en-US', { month: 'short' });

                  return (
                    <button
                      key={date}
                      onClick={() => setSelectedDate(date)}
                      className={`px-3 py-2.5 rounded-lg border-2 transition-all text-center ${
                        isSelected
                          ? 'border-black bg-black text-white shadow-md'
                          : isToday
                            ? 'border-gray-400 bg-white text-gray-900 hover:border-gray-500'
                            : 'border-gray-300 bg-white text-gray-700 hover:border-gray-400 hover:bg-gray-50'
                      }`}
                    >
                      <div className="text-xs font-medium mb-1">{dayName}</div>
                      <div
                        className={`text-base font-bold ${isSelected ? 'text-white' : 'text-gray-900'}`}
                      >
                        {dayNum}
                      </div>
                      <div className="text-xs">{month}</div>
                      {isToday && !isSelected && (
                        <div className="text-xs mt-1 font-medium text-gray-500">Today</div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {selectedDate && selectedSlot && (
              <div className="mb-6 p-4 bg-black rounded-lg border border-gray-200 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-white/10 rounded-lg p-2">
                      <CheckIcon className="w-5 h-5 text-white" aria-hidden="true" />
                    </div>
                    <div>
                      <p className="text-xs text-gray-300 mb-1 uppercase tracking-wide">
                        Selected Appointment
                      </p>
                      <p className="text-base font-bold text-white">
                        {formatDate(selectedDate)} • {formatTime(selectedSlot.start_time)} -{' '}
                        {formatTime(selectedSlot.end_time)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setSelectedSlot(null)}
                    className="text-white/80 hover:text-white transition-colors p-1.5 hover:bg-white/10 rounded"
                    aria-label="Clear selection"
                  >
                    <CloseIcon className="w-4 h-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {selectedDate && (
              <div className="mb-6 bg-gray-50 rounded-xl p-5 border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                    <ClockIcon className="w-4 h-4 text-gray-600" aria-hidden="true" />
                    Select Time
                  </label>
                  {loadingSlots ? (
                    <span
                      className="text-xs text-gray-500 flex items-center gap-2"
                      aria-busy="true"
                    >
                      <div className="animate-pulse h-3 w-3 rounded bg-gray-200"></div>
                      Updating slots…
                    </span>
                  ) : (
                    <span className="text-xs font-medium text-gray-600 bg-white px-2.5 py-1 rounded-full border border-gray-300">
                      {availableSlots.length} available{' '}
                      {bookedSlots.length > 0 && `• ${bookedSlots.length} booked`}
                    </span>
                  )}
                </div>

                {loadingSlots ? (
                  <div
                    className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 py-4"
                    aria-busy="true"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
                      <div key={i} className="h-10 bg-gray-200 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {closedMessage ? (
                      <div className="col-span-full text-center py-6">
                        <div className="inline-flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-3 text-sm font-medium">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            className="h-5 w-5 flex-shrink-0"
                            viewBox="0 0 20 20"
                            fill="currentColor"
                          >
                            <path
                              fillRule="evenodd"
                              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                              clipRule="evenodd"
                            />
                          </svg>
                          {closedMessage}
                        </div>
                      </div>
                    ) : slots.length === 0 ? (
                      <div className="col-span-full text-center py-6">
                        <ClockIcon
                          className="mx-auto h-10 w-10 text-gray-400 mb-2"
                          aria-hidden="true"
                        />
                        <p className="text-gray-500 font-medium text-sm">
                          No slots available for this date
                        </p>
                        <p className="text-xs text-gray-400 mt-1">Try selecting another date</p>
                      </div>
                    ) : (
                      slots
                        .filter((slot) => {
                          if (!salon) return true;
                          return isTimeInRange(
                            slot.start_time,
                            salon.opening_time,
                            salon.closing_time
                          );
                        })
                        .map((slot) => {
                          const isSelected = selectedSlot?.id === slot.id;
                          const isBooked = slot.status === 'booked';

                          return (
                            <button
                              key={slot.id}
                              onClick={() => handleSlotSelect(slot)}
                              disabled={isBooked}
                              className={`px-3 py-2.5 rounded-lg border-2 transition-all text-sm font-medium ${
                                isBooked
                                  ? 'border-gray-200 bg-white text-gray-400 cursor-not-allowed'
                                  : isSelected
                                    ? 'border-black bg-black text-white shadow-md'
                                    : 'border-gray-300 bg-white text-gray-700 hover:border-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {formatTime(slot.start_time)} - {formatTime(slot.end_time)}
                            </button>
                          );
                        })
                    )}
                  </div>
                )}
              </div>
            )}

            {selectedSlot && (
              <div className="space-y-4 pt-6 border-t border-gray-200">
                <div className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Your Details</h3>
                  <div>
                    <label
                      htmlFor="customer_name"
                      className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2"
                    >
                      <ProfileIcon className="w-4 h-4 text-gray-600" aria-hidden="true" />
                      Your Name <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="text"
                      id="customer_name"
                      value={customerName}
                      onChange={(e) => handleNameChange(e.target.value)}
                      onBlur={() => {
                        setTouchedName(true);
                        setNameError(validateName(customerName));
                      }}
                      placeholder="Enter your full name"
                      className={`w-full ${nameError && touchedName ? 'border-red-300 focus:ring-red-500' : ''}`}
                    />
                    {nameError && touchedName && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {nameError}
                      </p>
                    )}
                  </div>

                  <div className="mt-4">
                    <label
                      htmlFor="customer_phone"
                      className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-2"
                    >
                      <svg
                        className="w-4 h-4 text-gray-600"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                      </svg>
                      Phone Number <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Input
                        type="tel"
                        id="customer_phone"
                        value={customerPhone}
                        onChange={(e) => handlePhoneChange(e.target.value)}
                        onBlur={() => {
                          setTouchedPhone(true);
                          setPhoneError(validatePhone(customerPhone));
                        }}
                        placeholder="+91 9876543210"
                        className={`w-full ${phoneError && touchedPhone ? 'border-red-300 focus:ring-red-500' : ''}`}
                      />
                      {customerPhone && !phoneError && touchedPhone && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                          <CheckIcon className="w-5 h-5 text-green-500" aria-hidden="true" />
                        </div>
                      )}
                    </div>
                    {phoneError && touchedPhone && (
                      <p className="text-xs text-red-600 mt-1 flex items-center gap-1">
                        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                          <path
                            fillRule="evenodd"
                            d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z"
                            clipRule="evenodd"
                          />
                        </svg>
                        {phoneError}
                      </p>
                    )}
                    <p className="text-xs text-gray-500 mt-1">
                      We&apos;ll send booking confirmation via WhatsApp
                    </p>
                  </div>

                  {error && (
                    <div className="mt-4 bg-red-50 border-2 border-red-200 text-red-800 px-4 py-3 rounded-lg flex items-start gap-2">
                      <InfoIcon className="w-5 h-5 flex-shrink-0 mt-0.5" aria-hidden="true" />
                      <span>{error}</span>
                    </div>
                  )}

                  <Button
                    onClick={handleBookSlot}
                    disabled={
                      !selectedSlot ||
                      submitting ||
                      !!nameError ||
                      !!phoneError ||
                      !customerName.trim() ||
                      !customerPhone.trim()
                    }
                    size="lg"
                    className="w-full mt-4 bg-gradient-to-r from-black to-gray-800 hover:from-gray-900 hover:to-black text-white font-bold py-6 text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                  >
                    {submitting ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Processing...
                      </span>
                    ) : (
                      <span className="flex items-center justify-center gap-2">
                        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.867-.272 0-.372.149-.372.297 0 .343.396.416.785.57.39.153 1.562.724 1.808.867.247.144.38.223.38.446 0 .223-.297.372-.594.521-.297.15-1.758.867-2.03.867-.272 0-.372-.15-.372-.297 0-.343.396-.416.785-.57.39-.153 1.562-.724 1.808-.867.247-.144.38-.223.38-.446 0-.223-.297-.372-.594-.521zm-4.5-2.67c-.297-.15-1.758-.867-2.03-.867-.272 0-.372.15-.372.297 0 .343.396.416.785.57.39.153 1.562.724 1.808.867.247.144.38.223.38.446 0 .223-.297.372-.594.521-.297.15-1.758.867-2.03.867-.272 0-.372-.15-.372-.297 0-.343.396-.416.785-.57.39-.153 1.562-.724 1.808-.867.247-.144.38-.223.38-.446 0-.223-.297-.372-.594-.521zM12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.568 17.308c-.149.297-.446.446-.744.446-.149 0-.297-.05-.446-.149l-1.758-1.008c-.297-.149-.446-.446-.446-.744v-2.67c0-.297.149-.594.446-.744l1.758-1.008c.149-.1.297-.149.446-.149.297 0 .594.149.744.446.149.297.149.594 0 .892l-1.758 1.008v1.116l1.758 1.008c.149.297.149.594 0 .892z" />
                        </svg>
                        Book via WhatsApp
                      </span>
                    )}
                  </Button>

                  <p className="text-xs text-center text-gray-500 mt-4">
                    By booking, you agree to receive confirmation messages via WhatsApp
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
