'use client';

import { useMemo } from 'react';
import SalonRow from '@/components/customer/SalonRow';
import type { BookingForSalonRow } from '@/components/customer/customer-bookings-types';

export type { BookingForSalonRow } from '@/components/customer/customer-bookings-types';

export interface CustomerBookingsTableProps {
  bookings: BookingForSalonRow[];
}

/**
 * One row per unique salon; representative booking per salon (most recent) for status/display.
 */
function getUniqueSalonBookings(bookings: BookingForSalonRow[]): BookingForSalonRow[] {
  const bySalon = bookings.reduce<Record<string, BookingForSalonRow>>((acc, booking) => {
    const salonId = booking.business_id;
    if (!salonId) return acc;
    const existing = acc[salonId];
    if (!existing || booking.created_at > existing.created_at) {
      acc[salonId] = booking;
    }
    return acc;
  }, {});
  return Object.values(bySalon);
}

export default function CustomerBookingsTable({ bookings }: CustomerBookingsTableProps) {
  const uniqueSalons = useMemo(() => getUniqueSalonBookings(bookings), [bookings]);

  if (uniqueSalons.length === 0) {
    return null;
  }

  return (
    <div className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="table-auto w-full border-collapse border border-slate-200 rounded-md text-left">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50/80">
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 align-middle">
                Salon Name
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 align-middle">
                Location
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 align-middle">
                Owner Name
              </th>
              <th className="px-4 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 align-middle">
                Phone Number
              </th>
              <th className="px-4 py-3.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 align-middle w-[4rem]">
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {uniqueSalons.map((booking) => (
              <SalonRow key={booking.business_id} booking={booking} salonId={booking.business_id} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
