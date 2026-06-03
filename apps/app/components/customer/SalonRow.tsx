'use client';

import { useRouter } from 'next/navigation';
import ChevronRightIcon from '@cusown/shared/icons/chevron-right.svg';
import { UI_CUSTOMER } from '@cusown/config';
import { salonTelHref } from '@/components/customer/salon-tel-href';
import type { BookingForSalonRow } from '@/components/customer/customer-bookings-types';

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
    const salonSlug = salon?.booking_link || salonId;
    router.push(`/customer/salon/${salonSlug}`);
  };
  // Deleted salon: same layout, subtle indicator
  if (isDeleted) {
    return (
      <tr
        className="border-b border-border-primary bg-surface-elevated"
        aria-label={`${salonName} - No longer available`}
      >
        <td className="px-4 py-3.5 text-left text-sm font-medium text-text-secondary align-middle min-w-0 max-w-[12rem] sm:max-w-none break-words">
          {salonName}
        </td>
        <td className="px-4 py-3.5 text-left text-sm text-text-secondary align-middle">
          {location}
        </td>
        <td className="px-4 py-3.5 text-left text-sm text-text-secondary align-middle">
          {ownerName || ' '}
        </td>
        <td className="px-4 py-3.5 text-left text-sm text-text-secondary align-middle">
          {phone || ' '}
        </td>
        <td className="px-4 py-3.5 text-right align-middle">
          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-50 text-amber-600 border border-amber-200">
            {UI_CUSTOMER.SALON_UNAVAILABLE}
          </span>
        </td>
      </tr>
    );
  }

  return (
    <tr
      className="group border-b border-border-primary transition-colors hover:bg-surface-elevated cursor-pointer"
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
      <td className="px-4 py-3.5 text-left text-sm font-medium text-text-primary align-middle min-w-0 max-w-[12rem] sm:max-w-none break-words">
        {salonName}
      </td>
      <td className="px-4 py-3.5 text-left text-sm text-text-secondary align-middle">{location}</td>
      <td className="px-4 py-3.5 text-left text-sm text-text-secondary align-middle">
        {ownerName || ' '}
      </td>

      <td className="px-4 py-3.5 text-left text-sm text-text-secondary align-middle">
        {phone ? (
          <a
            href={salonTelHref(phone)}
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
        <span className="inline-flex items-center text-text-secondary transition-all duration-200 group-hover:text-green-600 group-hover:translate-x-0.5">
          <ChevronRightIcon className="h-5 w-5" aria-hidden />
        </span>
      </td>
    </tr>
  );
}
