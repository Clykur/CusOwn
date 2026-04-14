'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import SalonRow from '@/components/customer/SalonRow';
import SalonBookingCard from '@/components/customer/SalonBookingCard';
import Pagination from '@/components/ui/pagination';
import { CUSTOMER_DASHBOARD_SALONS_PER_PAGE, UI_CUSTOMER } from '@/config/constants';
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
  const [page, setPage] = useState(1);

  const totalItems = uniqueSalons.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / CUSTOMER_DASHBOARD_SALONS_PER_PAGE));

  const paginatedSalons = useMemo(() => {
    const start = (page - 1) * CUSTOMER_DASHBOARD_SALONS_PER_PAGE;
    return uniqueSalons.slice(start, start + CUSTOMER_DASHBOARD_SALONS_PER_PAGE);
  }, [uniqueSalons, page]);

  useEffect(() => {
    setPage(1);
  }, [uniqueSalons.length]);

  useEffect(() => {
    if (page > totalPages) {
      setPage(totalPages);
    }
  }, [page, totalPages]);

  const handlePageChange = useCallback((next: number) => {
    setPage(next);
  }, []);

  if (uniqueSalons.length === 0) {
    return null;
  }

  return (
    <div className="w-full min-w-0">
      <div className="md:hidden">
        <div className="flex flex-col gap-3">
          {paginatedSalons.map((booking) => (
            <SalonBookingCard
              key={booking.business_id}
              booking={booking}
              salonId={booking.business_id}
            />
          ))}
        </div>
      </div>

      <div className="hidden md:block">
        <div className="w-full min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full table-auto border-collapse rounded-md border border-slate-200 text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/80">
                  <th className="px-4 py-3.5 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {UI_CUSTOMER.DASHBOARD_TABLE_COL_SALON}
                  </th>
                  <th className="px-4 py-3.5 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {UI_CUSTOMER.DASHBOARD_TABLE_COL_LOCATION}
                  </th>
                  <th className="px-4 py-3.5 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {UI_CUSTOMER.DASHBOARD_TABLE_COL_OWNER}
                  </th>
                  <th className="px-4 py-3.5 text-left align-middle text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {UI_CUSTOMER.DASHBOARD_TABLE_COL_PHONE}
                  </th>
                  <th className="w-[4rem] px-4 py-3.5 text-right align-middle text-xs font-semibold uppercase tracking-wider text-slate-500">
                    {UI_CUSTOMER.DASHBOARD_TABLE_COL_ACTIONS}
                  </th>
                </tr>
              </thead>
              <tbody>
                {paginatedSalons.map((booking) => (
                  <SalonRow
                    key={booking.business_id}
                    booking={booking}
                    salonId={booking.business_id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Pagination
        currentPage={page}
        totalPages={totalPages}
        onPageChange={handlePageChange}
        totalItems={totalItems}
        itemsPerPage={CUSTOMER_DASHBOARD_SALONS_PER_PAGE}
        itemsLabel={UI_CUSTOMER.DASHBOARD_PAGINATION_ITEMS_NOUN}
        className="border-slate-200"
      />
    </div>
  );
}
