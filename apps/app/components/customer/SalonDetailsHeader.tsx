'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { CUSTOMER_SCREEN_TITLE_CLASSNAME, UI_CUSTOMER } from '@cusown/config';
import { cn } from '@cusown/shared';

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
  const [showOwnerInfo, setShowOwnerInfo] = useState(false);
  const formatTime = (time: string) => {
    const [hours, minutes] = time.split(':').map(Number);

    return new Date(0, 0, 0, hours, minutes).toLocaleTimeString('en-IN', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

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
        setSubText(`Closes at ${formatTime(closingTime)} • ${getTimeDiffString(now, close)} left`);
      } else {
        const nextOpen = new Date(open);

        // Handle overnight schedules
        if (close <= open && now >= open) {
          nextOpen.setDate(nextOpen.getDate() + 1);
        }

        // Handle normal schedules when today's opening time has passed
        if (close > open && now > open) {
          nextOpen.setDate(nextOpen.getDate() + 1);
        }

        setStatusText('Closed');
        setSubText(
          `Opens at ${formatTime(openingTime)} • ${getTimeDiffString(now, nextOpen)} left`
        );
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 60000);

    return () => clearInterval(interval);
  }, [openingTime, closingTime]);

  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      {/* Left Side */}
      <div className="min-w-0 flex-1">
        {/* Top Row */}
        <div className="flex items-center gap-2">
          <h1 className={cn(CUSTOMER_SCREEN_TITLE_CLASSNAME, 'min-w-0 truncate leading-tight')}>
            {salonName}
          </h1>

          <span
            className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${
              isOpen
                ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
                : 'border-red-500/20 bg-red-500/10 text-red-400'
            }`}
          >
            {statusText}
          </span>
        </div>

        {/* Bottom Row */}
        <div className="mt-1 text-sm text-text-secondary">{subText}</div>
      </div>

      {/* Owner Section */}
      <div className="relative flex shrink-0 items-center">
        {/* Desktop */}
        <div className="hidden items-center gap-3 md:flex">
          <div className="flex min-w-0 flex-col text-right">
            {ownerName && (
              <span className="font-medium leading-snug text-text-primary">{ownerName}</span>
            )}

            {ownerPhone && (
              <a
                href={`https://wa.me/${ownerPhone}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-0.5 text-sm font-medium text-text-secondary hover:text-brand-primary"
              >
                {ownerPhone}
              </a>
            )}
          </div>

          <div className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-border-primary shadow-md ring-1 ring-border-focus">
            <Image
              src={ownerImage || UI_CUSTOMER.DEFAULT_AVATAR_DATA_URI}
              alt={ownerName || 'Owner'}
              fill
              className="object-cover"
              sizes="48px"
              quality={95}
              unoptimized={!ownerImage}
            />
          </div>
        </div>

        {/* Mobile */}
        <div className="relative flex items-center md:hidden">
          <button
            type="button"
            onClick={() => setShowOwnerInfo((prev) => !prev)}
            className="relative h-12 w-12 overflow-hidden rounded-full"
          >
            <Image
              src={ownerImage || UI_CUSTOMER.DEFAULT_AVATAR_DATA_URI}
              alt={ownerName || 'Owner'}
              fill
              className="object-cover"
              sizes="48px"
              quality={95}
              unoptimized={!ownerImage}
            />
          </button>

          {showOwnerInfo && (
            <>
              {/* Blur Backdrop */}
              <div
                className="fixed inset-0 z-40 bg-black/10 backdrop-blur-sm"
                onClick={() => setShowOwnerInfo(false)}
              />

              {/* Inline Owner Info */}
              <div className="absolute right-14 top-1/2 z-50 flex max-w-[180px] -translate-y-1/2 flex-col items-end">
                {ownerName && (
                  <span
                    className="w-full truncate text-right text-sm font-medium text-text-primary"
                    title={ownerName}
                  >
                    {ownerName}
                  </span>
                )}

                {ownerPhone && (
                  <a
                    href={`https://wa.me/${ownerPhone}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 text-xs text-text-secondary hover:text-brand-primary"
                  >
                    {ownerPhone}
                  </a>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
