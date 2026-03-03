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

  const getStatusConfig = (status: string) => {
    if (isNoShow) {
      return {
        bg: 'bg-amber-50',
        border: 'border-amber-200',
        icon: <WarningIcon className="w-5 h-5 text-amber-600" aria-hidden="true" />,
        badge: 'bg-amber-100 text-amber-800',
        text: 'text-amber-900',
      };
    }
    switch (status) {
      case 'confirmed':
        return {
          bg: 'bg-green-50',
          border: 'border-green-200',
          icon: <CheckIcon className="w-5 h-5 text-green-600" aria-hidden="true" />,
          badge: 'bg-green-100 text-green-800',
          text: 'text-green-900',
        };
      case 'pending':
        return {
          bg: 'bg-yellow-50',
          border: 'border-yellow-200',
          icon: <ClockIcon className="w-5 h-5 text-yellow-600" aria-hidden="true" />,
          badge: 'bg-yellow-100 text-yellow-800',
          text: 'text-yellow-900',
        };
      case 'rejected':
        return {
          bg: 'bg-red-50',
          border: 'border-red-200',
          icon: <CloseIcon className="w-5 h-5 text-red-600" aria-hidden="true" />,
          badge: 'bg-red-100 text-red-800',
          text: 'text-red-900',
        };
      case 'cancelled':
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: <CloseIcon className="w-5 h-5 text-gray-600" aria-hidden="true" />,
          badge: 'bg-gray-100 text-gray-800',
          text: 'text-gray-900',
        };
      default:
        return {
          bg: 'bg-gray-50',
          border: 'border-gray-200',
          icon: <ClockIcon className="w-5 h-5 text-gray-600" aria-hidden="true" />,
          badge: 'bg-gray-100 text-gray-800',
          text: 'text-gray-900',
        };
    }
  };
  const statusConfig = getStatusConfig(booking.status);
  const [salonProfile, setSalonProfile] = useState<SalonProfile | null>(null);

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
        const salonData = result.data;
        setSalonProfile(salonData);
      })
      .catch(() => {
        if (!cancelled) {
          setSalonProfile(null);
        }
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
    <div className="bg-white border border-slate-200 rounded-lg overflow-hidden transition-all duration-200 hover:shadow-sm">
      <div className="p-4 sm:p-6">
        {/* Header Row: Salon Name left, Owner Info right */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex flex-col">
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 truncate leading-tight">
              {providerName}
            </h3>
            {location && (
              <div className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600">
                <MapPinIcon className="w-3.5 h-3.5" aria-hidden="true" />
                <span className="truncate">{location}</span>
              </div>
            )}
            {/* Business combined rating (all customers) */}
            {((booking.salon?.review_count ?? booking.business?.review_count ?? 0) > 0 ||
              booking.salon?.rating_avg != null ||
              booking.business?.rating_avg != null) && (
              <div className="mt-1.5 flex items-center gap-1.5 text-sm text-slate-700">
                <span className="text-amber-500 font-medium" aria-hidden="true">
                  ★
                </span>
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
          <div className="flex items-center gap-3">
            {/* Owner Profile Image */}
            {ownerImage && !ownerImage.startsWith('data:') ? (
              <Image
                src={ownerImage}
                alt={ownerName}
                className="w-8 h-8 rounded-full object-cover border border-gray-200"
                width={32}
                height={32}
              />
            ) : (
              <Image
                src={UI_CUSTOMER.DEFAULT_AVATAR_DATA_URI}
                alt={ownerName}
                className="w-8 h-8 rounded-full object-cover border border-gray-200"
                width={32}
                height={32}
                unoptimized
              />
            )}
            {/* Owner Name */}
            <span className="hidden sm:inline font-semibold text-base text-slate-900 truncate">
              {ownerName}
            </span>{' '}
            {/* Phone Icon & Number */}
            <div className="flex items-center text-gray-600 text-sm gap-1 min-w-0">
              {ownerPhone ? (
                <a
                  href={`tel:${ownerPhone}`}
                  className="hover:text-blue-600 font-medium truncate block max-w-[120px] sm:max-w-none"
                  title="Call Owner"
                >
                  {ownerPhone}
                </a>
              ) : (
                <span className="text-sm text-slate-400">N/A</span>
              )}
            </div>
          </div>
        </div>

        {booking.slot && (
          <div className="bg-slate-50 rounded-lg p-4 mb-4 border border-slate-100">
            <div className="flex flex-col gap-4">
              {/* Date + Time + Rating + View Details (same row, View Details on right) */}
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <div className="bg-white rounded-lg p-2 border border-slate-200">
                      <BookingsIcon className="w-4 h-4 text-slate-700" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Date</p>
                      <p className="font-semibold text-slate-900 text-sm sm:text-base truncate">
                        {formatDate(booking.slot.date)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white rounded-lg p-2 border border-slate-200">
                      <ClockIcon className="w-4 h-4 text-slate-700" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">Time</p>
                      <p className="font-semibold text-slate-900 text-sm sm:text-base">
                        {formatTime(booking.slot.start_time)} - {formatTime(booking.slot.end_time)}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="bg-white rounded-lg p-2 border border-slate-200 flex items-center justify-center">
                      <span className="text-amber-500 text-sm font-bold" aria-hidden="true">
                        ★
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs text-slate-500 uppercase tracking-wide mb-0.5">
                        {UI_CUSTOMER.LABEL_YOUR_RATING}
                      </p>
                      {booking.review ? (
                        <div className="flex items-center gap-2">
                          <StarRating value={booking.review.rating} readonly size="sm" />
                          <span className="font-semibold text-slate-900 text-sm">
                            {booking.review.rating} / 5
                          </span>
                        </div>
                      ) : booking.status === 'confirmed' ? (
                        <div className="space-y-1">
                          <StarRating
                            value={pendingRating}
                            readonly={false}
                            size="sm"
                            disabled={submittingRating}
                            onChange={async (rating) => {
                              setRatingError(null);
                              setPendingRating(rating);
                              setSubmittingRating(true);
                              try {
                                const res = await fetch('/api/reviews', {
                                  method: 'POST',
                                  headers: { 'Content-Type': 'application/json' },
                                  credentials: 'include',
                                  body: JSON.stringify({
                                    booking_id: booking.id,
                                    rating,
                                  }),
                                });
                                const data = await res.json();
                                if (!res.ok) {
                                  setRatingError(data?.error || UI_CUSTOMER.RATING_SUBMIT_FAILED);
                                  setPendingRating(0);
                                  return;
                                }
                                onRated?.();
                              } catch {
                                setRatingError(UI_CUSTOMER.RATING_SUBMIT_FAILED);
                                setPendingRating(0);
                              } finally {
                                setSubmittingRating(false);
                              }
                            }}
                          />
                          {ratingError && <p className="text-xs text-red-600">{ratingError}</p>}
                          {submittingRating && (
                            <p className="text-xs text-slate-500">
                              {UI_CUSTOMER.SUBMITTING_RATING}
                            </p>
                          )}
                        </div>
                      ) : (
                        <p className="font-semibold text-slate-500 text-sm">
                          {UI_CUSTOMER.LABEL_NOT_RATED}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
                <Link
                  href={`/booking/${booking.booking_id}`}
                  className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white font-semibold rounded-xl shadow-sm hover:bg-slate-800 hover:shadow transition-all text-sm whitespace-nowrap flex-shrink-0 border border-slate-900"
                >
                  {UI_CUSTOMER.VIEW_DETAILS}
                  <ChevronRightIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* Booking ID */}
            <div className="flex items-center gap-2 min-w-0">
              <p className="text-xs text-slate-500 whitespace-nowrap">
                {UI_CUSTOMER.LABEL_BOOKING_ID}:
              </p>
              <span className="font-mono text-xs bg-slate-50 px-2 py-1 rounded text-slate-700 border border-slate-200 truncate">
                {booking.booking_id}
              </span>
            </div>

            {/* Re-Book: outline style to differentiate from View Details */}
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
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white text-slate-800 font-semibold rounded-xl border-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 transition-all text-sm whitespace-nowrap shadow-sm"
            >
              {UI_CUSTOMER.REBOOK}
              <ChevronRightIcon className="w-4 h-4 shrink-0" aria-hidden="true" />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
