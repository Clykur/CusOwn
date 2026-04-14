'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ROUTES, getOwnerDashboardUrl } from '@/lib/utils/navigation';
import CheckIcon from '@/src/icons/check.svg';
import DownloadIcon from '@/src/icons/download.svg';
import LinkIcon from '@/src/icons/link.svg';
import ChevronRightIcon from '@/src/icons/chevron-right.svg';
import { APP_SCREEN_TITLE_CLASSNAME } from '@/config/constants';
import { cn } from '@/lib/utils/cn';

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
      <div className="bg-white rounded-2xl shadow-xl p-6 md:p-8 text-center">
        {/* Success Icon */}
        <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center mb-6">
          <CheckIcon className="w-10 h-10 text-green-600" />
        </div>

        <h2 className={cn(APP_SCREEN_TITLE_CLASSNAME, 'mb-2')}>Business Created Successfully</h2>
        <p className="text-gray-600 mb-6">
          Your booking page is live and ready to accept customers.
        </p>

        {/* Booking Link */}
        <div className="bg-gray-50 border rounded-lg p-4 mb-6">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold">
            <LinkIcon className="w-4 h-4" />
            Booking Link
          </div>

          <div className="flex gap-2">
            <input
              value={bookingUrl}
              readOnly
              className="flex-1 border px-3 py-2 rounded text-sm"
            />
            <button
              onClick={() => copyToClipboard(bookingUrl)}
              className="bg-black text-white px-4 rounded"
            >
              Copy
            </button>
          </div>

          <p className="text-xs text-gray-500 mt-2">
            Share this link on WhatsApp, Instagram, or anywhere customers can book you.
          </p>
        </div>

        {/* QR Code */}
        {qrCode && (
          <div className="mb-6">
            <p className="text-sm font-semibold mb-2">Scan & Book</p>

            <Image
              src={qrCode}
              alt="QR"
              width={180}
              height={180}
              className="mx-auto border p-2 rounded"
              unoptimized
            />

            <button
              onClick={() => {
                const a = document.createElement('a');
                a.href = qrCode;
                a.download = `${bookingLink}-qr.png`;
                a.click();
              }}
              className="mt-4 flex items-center gap-2 mx-auto bg-black text-white px-4 py-2 rounded"
            >
              <DownloadIcon className="w-4 h-4" />
              Download QR
            </button>

            <p className="text-xs text-gray-500 mt-2">
              Print and display this QR in your shop for walk-in customers.
            </p>
          </div>
        )}

        {/* Next Steps */}
        <div className="bg-blue-50 border-l-4 border-blue-500 rounded-lg p-3 md:p-4 mb-4 text-left">
          <p className="text-xs md:text-sm text-blue-800 font-semibold mb-2">Next Steps</p>
          <ul className="text-sm text-gray-700 space-y-2">
            <li className="flex items-center gap-2">
              <ChevronRightIcon className="w-4 h-4 text-gray-500" />
              <span>Share your booking link with customers</span>
            </li>

            <li className="flex items-center gap-2">
              <ChevronRightIcon className="w-4 h-4 text-gray-500" />
              <span>Add QR code in your shop</span>
            </li>

            <li className="flex items-center gap-2">
              <ChevronRightIcon className="w-4 h-4 text-gray-500" />
              <span>Start accepting bookings</span>
            </li>

            <li className="flex items-center gap-2">
              <ChevronRightIcon className="w-4 h-4 text-gray-500" />
              <span>Manage everything from your dashboard</span>
            </li>
          </ul>
        </div>

        {/* CTA */}
        <div className="space-y-3">
          <Link
            href={ROUTES.OWNER_DASHBOARD_BASE}
            className="block bg-black text-white py-3 rounded"
          >
            Go to Dashboard →
          </Link>

          <Link
            href={getOwnerDashboardUrl(bookingLink)}
            className="block text-sm text-gray-600 hover:text-black"
          >
            View this business →
          </Link>
        </div>
      </div>
    </div>
  );
}
