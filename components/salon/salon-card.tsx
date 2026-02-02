'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Salon } from '@/types';
import { getSecureSalonUrlClient } from '@/lib/utils/navigation';
import { isValidUUID } from '@/lib/utils/security';

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
              <svg
                className="w-5 h-5 text-gray-400 group-hover:text-black transition-colors"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </div>
          </div>

          {salon.location && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
              <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                />
              </svg>
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
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span>{formatTime(salon.opening_time)} - {formatTime(salon.closing_time)}</span>
              </div>
            )}
            {salon.slot_duration && (
              <div className="flex items-center gap-1.5">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                  />
                </svg>
                <span>{formatDuration(salon.slot_duration)} slots</span>
              </div>
            )}
          </div>
        </div>

        <div className="pt-4 border-t border-gray-100">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">View Available Slots</span>
            <svg
              className="w-5 h-5 text-gray-400 group-hover:text-black group-hover:translate-x-1 transition-all"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}
