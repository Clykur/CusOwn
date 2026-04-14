'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { CUSTOMER_SCREEN_TITLE_CLASSNAME, UI_CUSTOMER } from '@/config/constants';
import { cn } from '@/lib/utils/cn';

export interface SalonDetailsHeaderProps {
  salonName: string;
  ownerName: string | null;
  ownerPhone: string | null;
  ownerImage?: string | null;
  openingTime: string;
  closingTime: string;
}

const getTimeParts = (time: string) => {
  const [h, m] = time.split(':').map(Number);
  return { h, m };
};

const getTimeDiffString = (from: Date, to: Date) => {
  const diff = Math.max(0, to.getTime() - from.getTime());
  const mins = Math.floor(diff / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;

  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
};

export default function SalonDetailsHeader({
  salonName,
  ownerName,
  ownerPhone,
  ownerImage,
  openingTime,
  closingTime,
}: SalonDetailsHeaderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [statusText, setStatusText] = useState('');
  const [subText, setSubText] = useState('');

  useEffect(() => {
    const checkStatus = () => {
      const now = new Date();

      const { h: openH, m: openM } = getTimeParts(openingTime);
      const { h: closeH, m: closeM } = getTimeParts(closingTime);

      const open = new Date(now);
      open.setHours(openH, openM, 0, 0);

      const close = new Date(now);
      close.setHours(closeH, closeM, 0, 0);

      let openNow = false;

      if (close <= open) {
        openNow = now >= open || now < close;
      } else {
        openNow = now >= open && now < close;
      }

      setIsOpen(openNow);

      if (openNow) {
        setStatusText('Open Now');
        setSubText(`Closes in ${getTimeDiffString(now, close)}`);
      } else {
        setStatusText('Closed');
        setSubText(`Opens at ${openingTime}`);
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 60000);

    return () => clearInterval(interval);
  }, [openingTime, closingTime]);

  return (
    <div className="flex items-center justify-between mb-4">
      <div className="flex flex-col">
        <h1 className={cn(CUSTOMER_SCREEN_TITLE_CLASSNAME, 'leading-tight break-words')}>
          {salonName}
        </h1>

        <div className="flex flex-wrap items-center gap-2 mt-2">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-semibold ${
              isOpen ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
            }`}
          >
            {statusText}
          </span>

          <span className="text-gray-500 text-xs">{subText}</span>
        </div>
      </div>

      <div className="flex max-w-[min(100%,18rem)] shrink-0 items-center gap-3 sm:max-w-none">
        <div className="flex min-w-0 flex-col text-right">
          {ownerName && ownerName.trim() !== '' && (
            <span className="font-medium leading-snug text-slate-900">{ownerName}</span>
          )}

          {ownerPhone && (
            <a
              href={`https://wa.me/${ownerPhone}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-0.5 text-sm font-medium text-slate-600 hover:text-green-600"
              title="Chat on WhatsApp"
            >
              {ownerPhone}
            </a>
          )}
        </div>

        {ownerImage && ownerImage !== '' ? (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-slate-100 shadow-md ring-1 ring-slate-200/50">
            <Image
              src={ownerImage}
              alt={ownerName || 'Owner'}
              fill
              className="object-cover"
              sizes="48px"
              quality={95}
              priority
            />
          </div>
        ) : (
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-slate-100 shadow-md">
            <Image
              src={UI_CUSTOMER.DEFAULT_AVATAR_DATA_URI}
              alt={ownerName || 'Owner'}
              fill
              className="object-cover"
              sizes="48px"
              unoptimized
            />
          </div>
        )}
      </div>
    </div>
  );
}
