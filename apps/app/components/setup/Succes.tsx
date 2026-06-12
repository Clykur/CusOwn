'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ROUTES, getOwnerDashboardUrl } from '@cusown/shared';
import CheckIcon from '@cusown/shared/icons/check.svg';
import DownloadIcon from '@cusown/shared/icons/download.svg';
import LinkIcon from '@cusown/shared/icons/link.svg';
import ChevronRightIcon from '@cusown/shared/icons/chevron-right.svg';
import { APP_SCREEN_TITLE_CLASSNAME } from '@cusown/config';
import { cn } from '@cusown/shared';

type Props = {
  bookingLink: string;
  bookingUrl: string;
  qrCode?: string;
};

export default function BusinessSuccess({ bookingLink, bookingUrl, qrCode }: Props) {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied!');
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="bg-zinc-900/40 border border-white/10 rounded-2xl shadow-2xl p-6 md:p-8 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 mx-auto bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
          <CheckIcon className="w-10 h-10 text-emerald-400" />
        </div>

        <h2 className={cn(APP_SCREEN_TITLE_CLASSNAME, 'mb-2 text-white')}>
          Business Created Successfully
        </h2>
        <p className="text-zinc-400 mb-6">
          Your booking page is live and ready to accept customers.
        </p>

        {/* Booking Link */}
        <div className="bg-surface-elevated border border-border-primary rounded-lg p-4 mb-6 text-left">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-text-primary">
            <LinkIcon className="w-4 h-4 text-brand-primary" />
            Booking Link
          </div>

          <div className="flex gap-2">
            <input
              value={bookingUrl}
              readOnly
              className="flex-1 border border-border-primary bg-surface-input text-text-primary px-3 py-2 rounded-lg text-sm focus:outline-none"
            />
            <button
              onClick={() => copyToClipboard(bookingUrl)}
              className="bg-brand-primary text-text-inverse font-semibold px-4 rounded-lg hover:bg-brand-primaryHover transition-colors"
            >
              Copy
            </button>
          </div>

          <p className="text-xs text-zinc-500 mt-2">
            Share this link on WhatsApp, Instagram, or anywhere customers can book you.
          </p>
        </div>

        {/* QR Code */}
        {qrCode && (
          <div className="mb-6">
            <p className="text-sm font-semibold mb-2 text-text-primary">Scan & Book</p>

            <div className="relative mx-auto bg-white p-2 border border-border-primary rounded inline-block">
              <Image
                src={qrCode}
                alt="QR"
                width={180}
                height={180}
                className="mx-auto"
                unoptimized
              />
            </div>

            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = qrCode;
                a.download = `${bookingLink}-qr.png`;
                a.click();
              }}
              className="mt-4 flex items-center gap-2 mx-auto bg-brand-primary text-text-inverse px-4 py-2.5 rounded-lg font-semibold hover:bg-brand-primaryHover transition-colors"
            >
              <DownloadIcon className="w-4 h-4 text-text-inverse" />
              Download QR
            </button>

            <p className="text-xs text-zinc-500 mt-2">
              Print and display this QR in your shop for walk-in customers.
            </p>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-blue-500/10 border-l-4 border-blue-500 rounded-lg p-3 md:p-4 mb-4 text-left">
          <p className="text-xs md:text-sm text-blue-400 font-semibold mb-2">Next Steps</p>
          <ul className="text-sm text-zinc-400 space-y-2">
            <li className="flex items-center gap-2">
              <ChevronRightIcon className="w-4 h-4 text-zinc-500" />
              <span>Share your booking link with customers</span>
            </li>

            <li className="flex items-center gap-2">
              <ChevronRightIcon className="w-4 h-4 text-zinc-500" />
              <span>Add QR code in your shop</span>
            </li>

            <li className="flex items-center gap-2">
              <ChevronRightIcon className="w-4 h-4 text-zinc-500" />
              <span>Start accepting bookings</span>
            </li>

            <li className="flex items-center gap-2">
              <ChevronRightIcon className="w-4 h-4 text-zinc-500" />
              <span>Manage everything from your dashboard</span>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Link
            href={ROUTES.OWNER_DASHBOARD_BASE}
            className="block bg-brand-primary text-text-inverse font-semibold py-3.5 rounded-lg hover:bg-brand-primaryHover transition-colors"
          >
            Go to Dashboard →
          </Link>

          <Link
            href={getOwnerDashboardUrl(bookingLink)}
            className="block text-sm text-zinc-400 hover:text-white transition-colors"
          >
            View this business →
          </Link>
        </div>
      </div>
    </div>
  );
}
