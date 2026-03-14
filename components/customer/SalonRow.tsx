'use client';

import { useRouter } from 'next/navigation';
import ChevronRightIcon from '@/src/icons/chevron-right.svg';
import { UI_CUSTOMER } from '@/config/constants';
import type { BookingForSalonRow } from '@/components/customer/customer-bookings-types';

function telHref(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `tel:+91${digits}`;
  if (digits.length > 10 && digits.startsWith('91')) return `tel:+${digits}`;
  return `tel:${phone}`;
}

export interface SalonRowProps {
  booking: BookingForSalonRow;
  salonId: string;
}

export default function SalonRow({ booking, salonId }: SalonRowProps) {
  const router = useRouter();

  const salon = booking.salon;
  const salonName = salon?.salon_name ?? UI_CUSTOMER.PROVIDER_FALLBACK;
  const ownerName = salon?.owner_name?.trim() || '';
  const phone = salon?.whatsapp_number ?? '';
  const isDeleted = !!salon?.deleted_at;

  const location = salon?.location || salon?.address || ' ';
  const handleRowClick = () => {
    if (isDeleted) return;
    router.push(`/customer/salon/${salonId}`);
  };

  // Deleted salon: same layout, subtle indicator
  if (isDeleted) {
    return (
      <tr
        className="border-b border-slate-100 bg-slate-50/30"
        aria-label={`${salonName} - No longer available`}
      >
        <td className="px-4 py-3.5 text-left text-sm font-medium text-slate-500 align-middle min-w-0 max-w-[12rem] sm:max-w-none break-words">
          {salonName}
        </td>
        <td className="px-4 py-3.5 text-left text-sm text-slate-400 align-middle">{location}</td>
        <td className="px-4 py-3.5 text-left text-sm text-slate-400 align-middle">
          {ownerName || ' '}
        </td>
        <td className="px-4 py-3.5 text-left text-sm text-slate-400 align-middle">
          {phone || ' '}
        </td>
        <td className="px-4 py-3.5 text-right align-middle">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
            Unavailable
          </span>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className="group border-b border-slate-100 transition-colors hover:bg-gray-50 cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={handleRowClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleRowClick();
        }
      }}
      aria-label={`View ${salonName} details`}
    >
      <td className="px-4 py-3.5 text-left text-sm font-medium text-slate-800 align-middle min-w-0 max-w-[12rem] sm:max-w-none break-words">
        {salonName}
      </td>
      <td className="px-4 py-3.5 text-left text-sm text-slate-700 align-middle">{location}</td>
      <td className="px-4 py-3.5 text-left text-sm text-slate-700 align-middle">
        {ownerName || ' '}
      </td>

      <td className="px-4 py-3.5 text-left text-sm text-slate-700 align-middle">
        {phone ? (
          <a
            href={telHref(phone)}
            className="hover:text-green-700 transition"
            onClick={(e) => e.stopPropagation()}
          >
            {phone}
          </a>
        ) : (
          ' '
        )}
      </td>

      <td className="px-4 py-3.5 text-right align-middle">
        <span className="inline-flex items-center text-slate-400 transition-all duration-200 group-hover:text-green-600 group-hover:translate-x-0.5">
          <ChevronRightIcon className="h-5 w-5" aria-hidden />
        </span>
      </td>
    </tr>
  );
}
