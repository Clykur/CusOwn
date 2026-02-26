'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Salon } from '@/types';
import { getSecureSalonUrlClient } from '@/lib/utils/navigation';
import { isValidUUID } from '@/lib/utils/security';
import ChevronRightIcon from '@/src/icons/chevron-right.svg';
import MapPinIcon from '@/src/icons/map-pin.svg';
import ClockIcon from '@/src/icons/clock.svg';

interface SalonCardProps {
  salon: Salon;
}

export default function SalonCard({ salon }: SalonCardProps) {
  // Use booking_link as the identifier (salon list API doesn't return id for security)
  // For public salon listings, we use booking_link directly without secure URL generation
  const bookingLink = salon?.booking_link;

  // If we have an id (UUID from authenticated contexts), try to generate secure URL
  // Otherwise, use booking_link directly for public listings
  const [secureUrl, setSecureUrl] = useState<string>(
    bookingLink ? `/salon/${bookingLink}` : '/salon/unknown'
  );

  useEffect(() => {
    // If salon has an id (UUID), generate secure URL
    // Otherwise, use booking_link directly (public listing)
    if (salon?.id && isValidUUID(salon.id)) {
      let isMounted = true;
      let cancelled = false;

      const generateUrl = async () => {
        if (cancelled || !salon.id) return;

        try {
          const url = await getSecureSalonUrlClient(salon.id);
          if (isMounted && !cancelled && url) {
            setSecureUrl(url);
          }
        } catch (error) {
          console.error('Failed to generate secure URL:', error);
          // Fallback to booking_link if secure URL generation fails
          if (bookingLink && isMounted && !cancelled) {
            setSecureUrl(`/salon/${bookingLink}`);
          }
        }
      };

      generateUrl();
      return () => {
        cancelled = true;
        isMounted = false;
      };
    } else {
      // For public listings without id, just use booking_link
      if (bookingLink) {
        setSecureUrl(`/salon/${bookingLink}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salon?.id, bookingLink]);

  const formatTime = (time: string) => time.substring(0, 5);
  const formatDuration = (minutes: number) => {
    if (minutes < 60) return `${minutes} min`;
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
  };

  return (
    <Link href={secureUrl}>
      <div className="group relative bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-black hover:shadow-xl transition-all duration-200 cursor-pointer h-full flex flex-col">
        <div className="flex-1">
          <div className="flex items-start justify-between mb-3">
            <h3 className="text-xl font-bold text-gray-900 group-hover:text-black transition-colors pr-2">
              {salon.salon_name}
            </h3>
            <div className="flex-shrink-0">
              <ChevronRightIcon
                className="w-5 h-5 text-gray-400 group-hover:text-black transition-colors"
                aria-hidden="true"
              />
            </div>
          </div>

          {salon.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <MapPinIcon className="w-4 h-4 flex-shrink-0" aria-hidden="true" />
              <span className="truncate">{salon.location}</span>
            </div>
          )}

          {salon.address && (
            <p className="text-sm text-gray-500 mb-4 line-clamp-2 min-h-[2.5rem]">
              {salon.address}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-4">
            {salon.opening_time && salon.closing_time && (
              <div className="flex items-center gap-1.5">
                <ClockIcon className="w-4 h-4" aria-hidden="true" />
                <span>
                  {formatTime(salon.opening_time)} - {formatTime(salon.closing_time)}
                </span>
              </div>
            )}
            {salon.slot_duration && (
              <div className="flex items-center gap-1.5">
                <ClockIcon className="w-4 h-4" aria-hidden="true" />
                <span>{formatDuration(salon.slot_duration)} slots</span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">View Available Slots</span>
            <ChevronRightIcon
              className="w-5 h-5 text-gray-400 group-hover:text-black group-hover:translate-x-1 transition-all"
              aria-hidden="true"
            />
          </div>
        </div>
      </div>
    </Link>
  );
}
