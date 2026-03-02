'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Salon } from '@/types';
import { getSecureSalonUrlClient } from '@/lib/utils/navigation';
import { isValidUUID } from '@/lib/utils/security';
import MapPinIcon from '@/src/icons/map-pin.svg';
import ClockIcon from '@/src/icons/clock.svg';

interface SalonCardProps {
  salon: Salon & { distance_km?: number };
}

export default function SalonCard({ salon }: SalonCardProps) {
  const bookingLink = salon?.booking_link;

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
    <div className="group relative bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-black hover:shadow-xl transition-all duration-200 h-full flex flex-col">
      <div className="flex-1">
        <div className="flex items-start justify-between mb-3">
          <h3 className="text-xl font-bold text-gray-900 pr-2">{salon.salon_name}</h3>
          {salon.distance_km !== undefined && (
            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
              {salon.distance_km < 1
                ? `${(salon.distance_km * 1000).toFixed(0)}m`
                : `${salon.distance_km.toFixed(1)}km`}{' '}
              away
            </span>
          )}
        </div>

        {salon.location && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <MapPinIcon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{salon.location}</span>
          </div>
        )}

        {salon.address && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem] mb-1">
              {salon.address}
            </p>
            {salon.latitude && salon.longitude && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${salon.latitude},${salon.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-[10px] text-blue-600 hover:underline inline-flex items-center gap-1"
              >
                <MapPinIcon className="w-2.5 h-2.5" />
                Open in Google Maps
              </a>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-4 text-xs text-gray-500 mb-4">
          {salon.opening_time && salon.closing_time && (
            <div className="flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4" />
              <span>
                {formatTime(salon.opening_time)} - {formatTime(salon.closing_time)}
              </span>
            </div>
          )}

          {salon.slot_duration && (
            <div className="flex items-center gap-1.5">
              <ClockIcon className="w-4 h-4" />
              <span>{formatDuration(salon.slot_duration)} slots</span>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Action Row */}
      <div className="pt-4 border-t border-gray-100 flex items-center justify-between gap-3">
        <Link
          href={`/customer/${bookingLink}`}
          className="flex-1 text-center text-sm font-medium border border-gray-300 rounded-lg py-2 hover:bg-gray-100 transition"
        >
          View Business
        </Link>

        <Link
          href={secureUrl}
          className="flex-1 text-center text-sm font-medium bg-black text-white rounded-lg py-2 hover:bg-gray-800 transition"
        >
          View Slots
        </Link>
      </div>
    </div>
  );
}
