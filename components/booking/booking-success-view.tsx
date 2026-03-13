'use client';

import Link from 'next/link';
import { UI_CUSTOMER } from '@/config/constants';
import { ROUTES } from '@/lib/utils/navigation';
import CheckIcon from '@/src/icons/check.svg';

export interface BookingSuccessData {
  bookingId: string;
  whatsappUrl: string;
  bookingStatusUrl?: string;
}

interface BookingSuccessViewProps {
  success: BookingSuccessData;
}

export default function BookingSuccessView({ success }: BookingSuccessViewProps) {
  return (
    <div className="w-full">
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm text-center">
        <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckIcon className="w-8 h-8 text-white" aria-hidden="true" />
        </div>
        <h2 className="text-xl font-semibold text-slate-900 mb-2">
          {UI_CUSTOMER.BOOKING_SENT_HEADING}
        </h2>
        <p className="text-slate-600 mb-6">
          {UI_CUSTOMER.BOOKING_SENT_ID_LABEL}{' '}
          <strong className="text-slate-900">{success.bookingId}</strong>
        </p>
        <p className="text-sm text-slate-500 mb-6">{UI_CUSTOMER.BOOKING_SENT_WHATSAPP_HINT}</p>
        <button
          type="button"
          onClick={() => success.whatsappUrl && window.open(success.whatsappUrl, '_blank')}
          className="w-full bg-slate-900 text-white font-semibold py-3 px-6 rounded-xl hover:bg-slate-800 transition-colors mb-4"
        >
          {UI_CUSTOMER.CTA_OPEN_WHATSAPP}
        </button>
        {success.bookingId && (
          <Link
            href={ROUTES.BOOKING_STATUS(success.bookingId)}
            className="block w-full bg-slate-100 text-slate-800 font-semibold py-3 px-6 rounded-xl hover:bg-slate-200 transition-colors mb-4"
          >
            {UI_CUSTOMER.CTA_VIEW_BOOKING_STATUS}
          </Link>
        )}
        <p className="text-xs text-slate-500">{UI_CUSTOMER.BOOKING_SENT_CONFIRM_HINT}</p>
      </div>
    </div>
  );
}
