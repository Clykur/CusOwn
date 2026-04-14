'use client';

import { useRouter } from 'next/navigation';
import ChevronRightIcon from '@/src/icons/chevron-right.svg';
import { UI_CUSTOMER } from '@/config/constants';
import { salonTelHref } from '@/components/customer/salon-tel-href';
import type { BookingForSalonRow } from '@/components/customer/customer-bookings-types';

export interface SalonBookingCardProps {
  booking: BookingForSalonRow;
  salonId: string;
}

export default function SalonBookingCard({ booking, salonId }: SalonBookingCardProps) {
  const router = useRouter();

  const salon = booking.salon;
  const salonName = salon?.salon_name ?? UI_CUSTOMER.PROVIDER_FALLBACK;
  const ownerName = salon?.owner_name?.trim() || '';
  const phone = salon?.whatsapp_number ?? '';
  const isDeleted = !!salon?.deleted_at;
  const location = salon?.location || salon?.address || '—';

  const goToSalon = () => {
    if (isDeleted) return;
    router.push(`/customer/salon/${salonId}`);
  };

  if (isDeleted) {
    return (
      <article
        className="rounded-2xl border border-slate-200/90 bg-slate-50/50 p-4 shadow-sm"
        aria-label={`${salonName} — ${UI_CUSTOMER.SALON_UNAVAILABLE}`}
      >
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-slate-500">
            {salonName}
          </h3>
          <span className="shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
            {UI_CUSTOMER.SALON_UNAVAILABLE}
          </span>
        </div>
        <dl className="mt-3 border-t border-slate-200/80 pt-3">
          <div className="grid grid-cols-[minmax(5.5rem,7rem)_minmax(0,1fr)] items-start gap-x-3 gap-y-1">
            <dt className="pt-0.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-400">
              {UI_CUSTOMER.DASHBOARD_SALON_FIELD_LOCATION}
            </dt>
            <dd className="min-w-0 break-words text-right text-sm text-slate-400 leading-snug">
              {location}
            </dd>
          </div>
        </dl>
      </article>
    );
  }

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={goToSalon}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          goToSalon();
        }
      }}
      className="group cursor-pointer rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md active:scale-[0.99]"
      aria-label={`${UI_CUSTOMER.VIEW_DETAILS}: ${salonName}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-slate-900">
          {salonName}
        </h3>
        <span className="shrink-0 text-slate-300 transition group-hover:text-emerald-600 group-hover:translate-x-0.5">
          <ChevronRightIcon className="h-5 w-5" aria-hidden />
        </span>
      </div>

      <dl className="mt-3 space-y-0 divide-y divide-slate-100 border-t border-slate-100 pt-3 text-sm">
        <div className="grid grid-cols-[minmax(5.5rem,7rem)_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-2.5 first:pt-0">
          <dt className="pt-0.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            {UI_CUSTOMER.DASHBOARD_SALON_FIELD_LOCATION}
          </dt>
          <dd className="min-w-0 break-words text-right text-slate-800 leading-snug">{location}</dd>
        </div>
        <div className="grid grid-cols-[minmax(5.5rem,7rem)_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-2.5">
          <dt className="pt-0.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            {UI_CUSTOMER.DASHBOARD_SALON_FIELD_OWNER}
          </dt>
          <dd className="min-w-0 break-words text-right text-slate-800 leading-snug">
            {ownerName || '—'}
          </dd>
        </div>
        <div className="grid grid-cols-[minmax(5.5rem,7rem)_minmax(0,1fr)] items-start gap-x-3 gap-y-1 py-2.5 last:pb-0">
          <dt className="pt-0.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            {UI_CUSTOMER.DASHBOARD_SALON_FIELD_PHONE}
          </dt>
          <dd className="min-w-0 text-right leading-snug [text-wrap:pretty]">
            {phone ? (
              <a
                href={salonTelHref(phone)}
                className="font-medium text-emerald-700 underline-offset-2 hover:underline"
                onClick={(e) => e.stopPropagation()}
              >
                {phone}
              </a>
            ) : (
              <span className="text-slate-500">—</span>
            )}
          </dd>
        </div>
      </dl>
    </article>
  );
}
