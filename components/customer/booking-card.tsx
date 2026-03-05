'use client';

import Link from 'next/link';
import { formatDate, formatTime } from '@/lib/utils/string';
import { UI_CUSTOMER, UI_CONTEXT } from '@/config/constants';
import CheckIcon from '@/src/icons/check.svg';
import CloseIcon from '@/src/icons/close.svg';
import ClockIcon from '@/src/icons/clock.svg';
import WarningIcon from '@/src/icons/warning.svg';
import MapPinIcon from '@/src/icons/map-pin.svg';
import BookingsIcon from '@/src/icons/bookings.svg';
import ChevronRightIcon from '@/src/icons/chevron-right.svg';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';
import StarRating from '@/components/booking/star-rating';

interface CustomerBookingCardProps {
  booking: any;
  onRated?: () => void;
}

interface SalonProfile {
  id: string;
  salon_name?: string;
  location?: string;
  owner_name?: string;
  owner_image?: string;
  whatsapp_number?: string;
}

const FETCH_CACHE: RequestCache = 'default';

export default function CustomerBookingCard({ booking, onRated }: CustomerBookingCardProps) {
  const isNoShow = booking.status === 'confirmed' && booking.no_show;
  const [submittingRating, setSubmittingRating] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [pendingRating, setPendingRating] = useState(0);
  const [salonProfile, setSalonProfile] = useState<SalonProfile | null>(null);

  const getStatusConfig = (status: string) => {
    if (isNoShow) {
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: <WarningIcon className="w-5 h-5 text-amber-600" />,
        badge: 'bg-amber-100 text-amber-800',
        text: 'text-amber-900',
      };
    }

    switch (status) {
      case 'confirmed':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: <CheckIcon className="w-5 h-5 text-green-600" />,
          badge: 'bg-green-100 text-green-800',
          text: 'text-green-900',
        };
      case 'pending':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: <ClockIcon className="w-5 h-5 text-yellow-600" />,
          badge: 'bg-yellow-100 text-yellow-800',
          text: 'text-yellow-900',
        };
      case 'rejected':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: <CloseIcon className="w-5 h-5 text-red-600" />,
          badge: 'bg-red-100 text-red-800',
          text: 'text-red-900',
        };
      case 'cancelled':
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: <CloseIcon className="w-5 h-5 text-gray-600" />,
          badge: 'bg-gray-100 text-gray-800',
          text: 'text-gray-900',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: <ClockIcon className="w-5 h-5 text-gray-600" />,
          badge: 'bg-gray-100 text-gray-800',
          text: 'text-gray-900',
        };
    }
  };

  const statusConfig = getStatusConfig(booking.status);

  useEffect(() => {
    const salonId = booking.salon?.id;
    const businessId = booking.business?.id;
    const idToUse = salonId || businessId;
    if (!idToUse) return;

    let cancelled = false;

    fetch(`/api/salons/${idToUse}`, { cache: FETCH_CACHE })
      .then((res) => res.json())
      .then((result: { success?: boolean; data?: SalonProfile }) => {
        if (cancelled) return;
        if (!result.success || !result.data) {
          setSalonProfile(null);
          return;
        }
        setSalonProfile(result.data);
      })
      .catch(() => {
        if (!cancelled) setSalonProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [booking.salon?.id, booking.business?.id]);

  const providerName =
    salonProfile?.salon_name ||
    booking.salon?.salon_name ||
    booking.business?.salon_name ||
    UI_CUSTOMER.PROVIDER_FALLBACK;

  const location = salonProfile?.location || booking.salon?.location || booking.business?.location;

  const ownerName = salonProfile?.owner_name?.trim() ? salonProfile.owner_name : 'Owner';
  const ownerPhone = salonProfile?.whatsapp_number || '';

  const ownerImage =
    salonProfile?.owner_image && salonProfile.owner_image !== ''
      ? salonProfile.owner_image
      : UI_CUSTOMER.DEFAULT_AVATAR_DATA_URI;

  return (
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:shadow-sm transition">
      {/* MOBILE VIEW */}
      <div className="md:hidden p-4 space-y-4">
        {/* Header: Salon Name / Owner / Phone */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg font-bold text-slate-900">{providerName}</h3>

            {location && (
              <div className="flex items-center gap-1 text-sm text-slate-600">
                <MapPinIcon className="w-3 h-3" />
                {location}
              </div>
            )}

            {((booking.salon?.review_count ?? booking.business?.review_count ?? 0) > 0 ||
              booking.salon?.rating_avg != null ||
              booking.business?.rating_avg != null) && (
              <div className="text-sm text-slate-700">
                <span className="text-amber-500">★</span>{' '}
                {(booking.salon?.rating_avg ?? booking.business?.rating_avg)?.toFixed(1)}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Image
              src={ownerImage}
              alt={ownerName}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full border object-cover"
              unoptimized={ownerImage.startsWith('data:')}
            />

            {ownerPhone ? (
              <a href={`tel:${ownerPhone}`} className="text-sm text-blue-600 font-medium">
                {ownerPhone}
              </a>
            ) : (
              <span className="text-sm text-slate-400">N/A</span>
            )}
          </div>
        </div>

        {/* Date and Time */}
        {booking.slot && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500 uppercase">Date</span>
              <span className="font-semibold">{formatDate(booking.slot.date)}</span>
            </div>

            <div className="flex justify-between text-sm">
              <span className="text-slate-500 uppercase">Time</span>
              <span className="font-semibold">
                {formatTime(booking.slot.start_time)} - {formatTime(booking.slot.end_time)}
              </span>
            </div>
          </div>
        )}

        {/* Appointment ID */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-500">{UI_CUSTOMER.LABEL_BOOKING_ID}:</span>
          <span className="font-mono text-xs bg-slate-50 px-2 py-1 rounded border">
            {booking.booking_id}
          </span>
        </div>

        {/* Your Rating */}
        {booking.slot && (
          <div className="flex justify-between text-sm items-center">
            <span className="text-slate-500 uppercase">{UI_CUSTOMER.LABEL_YOUR_RATING}</span>

            {booking.review ? (
              <StarRating value={booking.review.rating} readonly size="sm" />
            ) : booking.status === 'confirmed' ? (
              <StarRating
                value={pendingRating}
                readonly={false}
                size="sm"
                disabled={submittingRating}
                onChange={async (rating) => {
                  setPendingRating(rating);
                  setSubmittingRating(true);

                  try {
                    const res = await fetch('/api/reviews', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        booking_id: booking.id,
                        rating,
                      }),
                    });

                    if (res.ok) onRated?.();
                  } finally {
                    setSubmittingRating(false);
                  }
                }}
              />
            ) : (
              <p className="text-sm text-slate-500">{UI_CUSTOMER.LABEL_NOT_RATED}</p>
            )}
          </div>
        )}

        {/* Bottom Action Row: View Details (Left) and Re-Book (Right) */}
        <div className="flex items-center justify-between gap-3 pt-3 mt-2 border-t border-slate-200">
          {' '}
          <Link
            href={`/booking/${booking.booking_id}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {UI_CUSTOMER.VIEW_DETAILS}
            <ChevronRightIcon className="w-4 h-4" />
          </Link>
          <Link
            href={`/book/${booking.salon?.booking_link || booking.business?.booking_link}`}
            onClick={() => {
              sessionStorage.setItem(
                'rebookData',
                JSON.stringify({
                  name: booking.customer_name,
                  phone: booking.customer_phone,
                })
              );
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-slate-800 font-semibold rounded-xl border-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 text-sm"
          >
            {UI_CUSTOMER.REBOOK}
            <ChevronRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>

      {/* DESKTOP VIEW */}
      <div className="hidden md:block p-4 md:p-6 space-y-4">
        {/* HEADER */}
        <div className="flex justify-between items-start">
          <div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{providerName}</h3>

            {location && (
              <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
                <MapPinIcon className="w-3.5 h-3.5" />
                <span className="truncate">{location}</span>
              </div>
            )}

            {((booking.salon?.review_count ?? booking.business?.review_count ?? 0) > 0 ||
              booking.salon?.rating_avg != null ||
              booking.business?.rating_avg != null) && (
              <div className="mt-1.5 flex items-center gap-1 text-sm text-slate-700">
                <span className="text-amber-500">★</span>
                <span>
                  {UI_CUSTOMER.LABEL_BUSINESS_RATING}:{' '}
                  {UI_CONTEXT.BUSINESS_RATING_REVIEWS(
                    String(
                      (booking.salon?.rating_avg ?? booking.business?.rating_avg)?.toFixed(1) ?? '—'
                    ),
                    booking.salon?.review_count ?? booking.business?.review_count ?? 0
                  )}
                </span>
              </div>
            )}
          </div>

          {/* OWNER */}
          <div className="flex items-center gap-2">
            <Image
              src={ownerImage}
              alt={ownerName}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full border object-cover"
              unoptimized={ownerImage.startsWith('data:')}
            />

            <span className="font-semibold text-sm sm:text-base text-slate-900 truncate max-w-[120px]">
              {ownerName}
            </span>

            {ownerPhone ? (
              <a href={`tel:${ownerPhone}`} className="text-sm text-blue-600 font-medium truncate">
                {ownerPhone}
              </a>
            ) : (
              <span className="text-sm text-slate-400">N/A</span>
            )}
          </div>
        </div>

        {/* Date, Time, Appointment ID and Rating - All in one row */}
        {booking.slot && (
          <div className="grid grid-cols-4 gap-4">
            {/* Date */}
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 rounded-lg p-2">
                <BookingsIcon className="w-4 h-4 text-slate-700" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Date</p>
                <p className="font-semibold text-sm">{formatDate(booking.slot.date)}</p>
              </div>
            </div>

            {/* Time */}
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 rounded-lg p-2">
                <ClockIcon className="w-4 h-4 text-slate-700" />
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Time</p>
                <p className="font-semibold text-sm whitespace-nowrap">
                  {formatTime(booking.slot.start_time)} - {formatTime(booking.slot.end_time)}
                </p>
              </div>
            </div>

            {/* Appointment ID */}
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 rounded-lg p-2">
                <span className="text-xs font-bold text-slate-700">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="w-4 h-4 text-slate-700"
                  >
                    <rect x="3" y="6" width="18" height="12" rx="2" ry="2"></rect>
                    <line x1="7" y1="10" x2="17" y2="10"></line>
                    <line x1="7" y1="14" x2="13" y2="14"></line>
                  </svg>
                </span>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">APPOINTMENT ID</p>
                <p className="font-mono text-xs">{booking.booking_id.slice(-6)}</p>
              </div>
            </div>

            {/* Your Rating */}
            <div className="flex items-center gap-2">
              <div className="bg-slate-100 rounded-lg p-2">
                <span className="text-amber-500 font-bold">★</span>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase">Rating</p>
                {booking.review ? (
                  <div className="flex items-center gap-1">
                    <StarRating value={booking.review.rating} readonly size="sm" />
                    <span className="text-sm font-semibold">{booking.review.rating}</span>
                  </div>
                ) : booking.status === 'confirmed' ? (
                  <StarRating
                    value={pendingRating}
                    readonly={false}
                    size="sm"
                    disabled={submittingRating}
                    onChange={async (rating) => {
                      setPendingRating(rating);
                      setSubmittingRating(true);
                      try {
                        const res = await fetch('/api/reviews', {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ booking_id: booking.id, rating }),
                        });
                        if (res.ok) onRated?.();
                      } finally {
                        setSubmittingRating(false);
                      }
                    }}
                  />
                ) : (
                  <p className="text-xs text-slate-500">Not rated</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Bottom Action Row: View Details (Left) and Re-Book (Right) */}
        <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
          <Link
            href={`/booking/${booking.booking_id}`}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 hover:bg-slate-50"
          >
            {UI_CUSTOMER.VIEW_DETAILS}
            <ChevronRightIcon className="w-4 h-4" />
          </Link>

          <Link
            href={`/book/${booking.salon?.booking_link || booking.business?.booking_link}`}
            onClick={() => {
              sessionStorage.setItem(
                'rebookData',
                JSON.stringify({
                  name: booking.customer_name,
                  phone: booking.customer_phone,
                })
              );
            }}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-slate-800 font-semibold rounded-xl border-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 text-sm"
          >
            {UI_CUSTOMER.REBOOK}
            <ChevronRightIcon className="w-4 h-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
