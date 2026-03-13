'use client';

import { memo } from 'react';
import Image from 'next/image';
import MapPinIcon from '@/src/icons/map-pin.svg';
import { UI_CUSTOMER, UI_CONTEXT } from '@/config/constants';
import type { SalonData } from './types';

interface BookingCardHeaderProps {
  salonData: SalonData;
  variant: 'mobile' | 'desktop';
}

function BookingCardHeaderComponent({ salonData, variant }: BookingCardHeaderProps) {
  const { providerName, location, ownerName, ownerPhone, ownerImage, ratingAvg, reviewCount } =
    salonData;

  if (variant === 'mobile') {
    return (
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-slate-900">{providerName}</h3>
          {location && (
            <div className="flex items-center gap-1 text-sm text-slate-600">
              <MapPinIcon className="w-3 h-3" />
              {location}
            </div>
          )}
          {(reviewCount > 0 || ratingAvg != null) && (
            <div className="text-sm text-slate-700">
              <span className="text-amber-500">★</span> {ratingAvg?.toFixed(1)}
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
    );
  }

  return (
    <div className="flex justify-between items-start">
      <div>
        <h3 className="text-lg sm:text-xl font-bold text-slate-900 truncate">{providerName}</h3>
        {location && (
          <div className="mt-1 flex items-center gap-1.5 text-sm text-slate-600">
            <MapPinIcon className="w-3.5 h-3.5" />
            <span className="truncate">{location}</span>
          </div>
        )}
        {(reviewCount > 0 || ratingAvg != null) && (
          <div className="mt-1.5 flex items-center gap-1 text-sm text-slate-700">
            <span className="text-amber-500">★</span>
            <span>
              {UI_CUSTOMER.LABEL_BUSINESS_RATING}:{' '}
              {UI_CONTEXT.BUSINESS_RATING_REVIEWS(
                String(ratingAvg?.toFixed(1) ?? '—'),
                reviewCount
              )}
            </span>
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
  );
}

export const BookingCardHeader = memo(BookingCardHeaderComponent);
