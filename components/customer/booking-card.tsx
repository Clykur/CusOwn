'use client';

import Link from 'next/link';
import { formatDate, formatTime } from '@/lib/utils/string';
import { UI_CUSTOMER } from '@/config/constants';
import CheckIcon from '@/src/icons/check.svg';
import CloseIcon from '@/src/icons/close.svg';
import ClockIcon from '@/src/icons/clock.svg';
import WarningIcon from '@/src/icons/warning.svg';
import MapPinIcon from '@/src/icons/map-pin.svg';
import BookingsIcon from '@/src/icons/bookings.svg';
import ChevronRightIcon from '@/src/icons/chevron-right.svg';
import React, { useEffect, useState } from 'react';
import Image from 'next/image';

interface CustomerBookingCardProps {
  booking: any;
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

export default function CustomerBookingCard({ booking }: CustomerBookingCardProps) {
  const isNoShow = booking.status === 'confirmed' && booking.no_show;

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
            <span className="font-semibold text-base text-slate-900 truncate">{ownerName}</span>
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
            <div className="grid grid-cols-2 gap-4">
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
            </div>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <Link
            href={`/booking/${booking.booking_id}`}
            className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-900 text-white font-semibold rounded-lg hover:bg-slate-800 transition-all text-sm sm:text-base"
          >
            View Details
            <ChevronRightIcon className="w-4 h-4" aria-hidden="true" />
          </Link>
        </div>

        <div className="mt-3 pt-3 border-t border-slate-200">
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{UI_CUSTOMER.LABEL_BOOKING_ID}:</p>
            <span className="font-mono text-xs bg-slate-50 px-2 py-1 rounded text-slate-700 border border-slate-200">
              {booking.booking_id}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
