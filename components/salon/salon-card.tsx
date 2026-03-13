'use client';

import { useState, useEffect, memo, useMemo } from 'react';
import Link from 'next/link';
import { Salon } from '@/types';
import { getSecureSalonUrlClient } from '@/lib/utils/navigation';
import { isValidUUID } from '@/lib/utils/security';
import { getCachedReviews, getReviewsFromCache } from '@/lib/cache/reviews-cache';
import MapPinIcon from '@/src/icons/map-pin.svg';
import ClockIcon from '@/src/icons/clock.svg';
import StarRating from '@/components/booking/star-rating';

const formatTime = (time: string) => time.substring(0, 5);

const formatDuration = (minutes: number) => {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
};

interface SalonCardProps {
  salon: Salon & {
    distance_km?: number;
    rating_avg?: number | null;
  };
}

function SalonCardComponent({ salon }: SalonCardProps) {
  const bookingLink = salon?.booking_link;

  const [secureUrl, setSecureUrl] = useState<string>(
    bookingLink ? `/salon/${bookingLink}` : '/salon/unknown'
  );
  // Use rating_avg from salon prop (comes from API) - more efficient than fetching separately
  const [ratingAvg, setRatingAvg] = useState<number | null>(null);

  // Initialize rating from salon prop (from API)
  useEffect(() => {
    if (salon?.rating_avg != null) {
      setRatingAvg(salon.rating_avg);
    }
  }, [salon?.rating_avg]);

  useEffect(() => {
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
      if (bookingLink) {
        setSecureUrl(`/salon/${bookingLink}`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [salon?.id, bookingLink]);

  useEffect(() => {
    if (!salon?.id || ratingAvg !== null) return;

    let cancelled = false;

    const cached = getReviewsFromCache(salon.id);
    if (cached) {
      setRatingAvg(cached.rating_avg);
      return;
    }

    getCachedReviews(salon.id).then((data) => {
      if (!cancelled && data) {
        setRatingAvg(data.rating_avg);
      } else if (!cancelled) {
        setRatingAvg(0);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [salon?.id, ratingAvg]);

  const mapsUrl = useMemo(() => {
    if (salon.latitude && salon.longitude) {
      return `https://www.google.com/maps/search/?api=1&query=${salon.latitude},${salon.longitude}`;
    }
    return null;
  }, [salon.latitude, salon.longitude]);

  return (
    <div className="group relative bg-white rounded-xl border-2 border-gray-200 p-6 hover:border-black hover:shadow-xl transition-all duration-200 h-full flex flex-col">
      <div className="flex-1">
        <div className="flex items-start justify-between mb-3">
          {/* Salon Name + Rating */}
          <div>
            <h3 className="text-xl font-bold text-gray-900 pr-2">{salon.salon_name}</h3>

            {ratingAvg != null && ratingAvg > 0 && (
              <div className="flex items-center gap-1 mt-1">
                <StarRating value={Math.round(ratingAvg)} readonly size="sm" />

                <span className="text-sm font-semibold text-gray-800">{ratingAvg.toFixed(1)}</span>
              </div>
            )}
          </div>

          {/* Distance */}
          {salon.distance_km !== undefined && (
            <span className="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap">
              {salon.distance_km < 1
                ? `${(salon.distance_km * 1000).toFixed(0)}m`
                : `${salon.distance_km.toFixed(1)}km`}{' '}
              away
            </span>
          )}
        </div>

        {/* Location */}
        {salon.location && (
          <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
            <MapPinIcon className="w-4 h-4 flex-shrink-0" />
            <span className="truncate">{salon.location}</span>
          </div>
        )}

        {/* Address */}
        {salon.address && (
          <div className="mb-4">
            <p className="text-sm text-gray-500 line-clamp-2 min-h-[2.5rem] mb-1">
              {salon.address}
            </p>

            {mapsUrl && (
              <a
                href={mapsUrl}
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

        {/* Time + Slot Duration */}
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

const SalonCard = memo(SalonCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.salon.id === nextProps.salon.id &&
    prevProps.salon.rating_avg === nextProps.salon.rating_avg &&
    prevProps.salon.distance_km === nextProps.salon.distance_km
  );
});

export default SalonCard;
