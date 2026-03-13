'use client';

import { memo } from 'react';
import Link from 'next/link';
import ChevronRightIcon from '@/src/icons/chevron-right.svg';
import { UI_CUSTOMER } from '@/config/constants';

interface BookingCardActionsProps {
  bookingId: string;
  bookingLink: string;
  customerName: string;
  customerPhone: string;
}

function BookingCardActionsComponent({
  bookingId,
  bookingLink,
  customerName,
  customerPhone,
}: BookingCardActionsProps) {
  const handleRebookClick = () => {
    sessionStorage.setItem(
      'rebookData',
      JSON.stringify({
        name: customerName,
        phone: customerPhone,
      })
    );
  };

  return (
    <div className="flex items-center justify-between gap-3 pt-2 border-t border-slate-200">
      <Link
        href={`/booking/${bookingId}`}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 border border-slate-300 rounded-xl text-sm font-semibold text-slate-800 hover:bg-slate-50 active:scale-[0.98] transition-all duration-150"
      >
        {UI_CUSTOMER.VIEW_DETAILS}
        <ChevronRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
      <Link
        href={`/book/${bookingLink}`}
        onClick={handleRebookClick}
        className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-slate-800 font-semibold rounded-xl border-2 border-slate-300 hover:bg-slate-50 hover:border-slate-400 active:scale-[0.98] transition-all duration-150 text-sm"
      >
        {UI_CUSTOMER.REBOOK}
        <ChevronRightIcon className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
      </Link>
    </div>
  );
}

export const BookingCardActions = memo(BookingCardActionsComponent);
