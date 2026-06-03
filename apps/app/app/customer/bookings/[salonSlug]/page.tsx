'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { setRebookData } from '@/components/booking/booking-utils';
import { CUSTOMER_SCREEN_TITLE_CLASSNAME, UI_CUSTOMER } from '@cusown/config';
import { formatDate, formatTime } from '@cusown/shared';
import { BookingWithDetails } from '@cusown/shared';
import Breadcrumb from '@/components/ui/breadcrumb';

type Params = { salonSlug?: string };

function getStatusLabel(booking: BookingWithDetails) {
  switch (booking.status) {
    case 'confirmed':
      return 'Confirmed';
    case 'pending':
      return 'Pending';
    case 'rejected':
      return 'Rejected';
    case 'cancelled':
      return 'Cancelled';
    default:
      // Enforce allowed statuses only in UI
      return 'Pending';
  }
}

function getStatusBadgeClass(booking: BookingWithDetails) {
  switch (booking.status) {
    case 'confirmed':
      return 'bg-emerald-900/20 text-emerald-400 border-emerald-800/50';
    case 'pending':
      return 'bg-amber-900/20 text-amber-400 border-amber-800/50';
    case 'rejected':
      return 'bg-rose-900/20 text-rose-400 border-rose-800/50';
    case 'cancelled':
      return 'bg-surface-elevated text-text-secondary border-border-primary';
    default:
      return 'bg-surface-elevated text-text-secondary border-border-primary';
  }
}

function BookingDetailModal({
  booking,
  onClose,
}: {
  booking: BookingWithDetails;
  onClose: () => void;
}) {
  const slotDate = booking.slot?.date ? formatDate(booking.slot.date) : null;
  const slotTime =
    booking.slot?.start_time && booking.slot?.end_time
      ? `${formatTime(booking.slot.start_time)} – ${formatTime(booking.slot.end_time)}`
      : null;

  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);

  const slotStart = useMemo(() => {
    if (!booking.slot?.date || !booking.slot?.start_time) return null;
    const startTimeRaw = String(booking.slot.start_time);
    const d = startTimeRaw.includes('T')
      ? new Date(startTimeRaw)
      : new Date(`${booking.slot.date}T${startTimeRaw}`);
    return Number.isFinite(d.getTime()) ? d : null;
  }, [booking.slot?.date, booking.slot?.start_time]);

  const hasSlotPassed = useMemo(() => {
    if (!slotStart) return false;
    return slotStart.getTime() <= Date.now();
  }, [slotStart]);

  // Disable WhatsApp if slot passed OR booking is not pending.
  const canOpenWhatsApp = booking.status === 'pending' && !hasSlotPassed;

  useEffect(() => {
    let cancelled = false;
    if (!canOpenWhatsApp) {
      setWhatsappUrl(null);
      return;
    }
    if (!booking.booking_id) return;

    (async () => {
      try {
        setWhatsappLoading(true);
        const res = await fetch(`/api/bookings/${booking.booking_id}/whatsapp`, {
          credentials: 'include',
        });
        const json = await res.json();
        if (!cancelled && res.ok && json?.success && json?.data?.whatsapp_url) {
          setWhatsappUrl(json.data.whatsapp_url);
        }
      } catch {
        if (!cancelled) setWhatsappUrl(null);
      } finally {
        if (!cancelled) setWhatsappLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [booking.booking_id, canOpenWhatsApp]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="booking-detail-title"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border-primary bg-surface-card p-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 id="booking-detail-title" className={CUSTOMER_SCREEN_TITLE_CLASSNAME}>
              {UI_CUSTOMER.VIEW_DETAILS}
            </h2>
            <p className="mt-0.5 text-sm text-text-secondary">Booking details</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-text-secondary hover:bg-surface-elevated hover:text-text-primary focus:outline-none focus:ring-2 focus:ring-border-focus"
            aria-label="Close"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>

        <div
          className={`mb-5 rounded-xl border-2 px-5 py-4 ${
            booking.status === 'confirmed'
              ? 'bg-emerald-900/20 border-emerald-800/50 text-emerald-400'
              : booking.status === 'pending'
                ? 'bg-amber-900/20 border-amber-800/50 text-amber-400'
                : booking.status === 'rejected'
                  ? 'bg-rose-900/20 border-rose-800/50 text-rose-400'
                  : 'bg-surface-elevated border-border-primary text-text-primary'
          }`}
        >
          <p className="font-bold text-base">{getStatusLabel(booking)}</p>
          {slotDate && slotTime && (
            <p className="mt-1 text-sm opacity-90">
              {slotDate} · {slotTime}
            </p>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-border-primary bg-surface-elevated p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">
              Business details
            </p>
            <div className="space-y-1 text-sm">
              <p className="font-semibold text-text-primary">
                {booking.salon?.salon_name ?? UI_CUSTOMER.PROVIDER_FALLBACK}
              </p>
              {booking.salon?.owner_name && (
                <p className="text-text-secondary">{booking.salon.owner_name}</p>
              )}
              {booking.salon?.whatsapp_number && (
                <p className="text-text-secondary">{booking.salon.whatsapp_number}</p>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-border-primary bg-surface-elevated p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-text-secondary mb-2">
              Appointment details
            </p>
            <div className="space-y-1 text-sm">
              <p className="text-text-primary">
                <span className="font-medium text-text-secondary">Booking ID:</span>{' '}
                <span className="font-mono text-text-primary break-all">{booking.booking_id}</span>
              </p>
              <p className="text-text-primary">
                <span className="font-medium text-text-secondary">Time:</span>{' '}
                {slotDate && slotTime ? `${slotDate} · ${slotTime}` : ' '}
              </p>
              <p className="text-text-primary">
                <span className="font-medium text-text-secondary">Service:</span>{' '}
                {booking.service_name || '—'}
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-col gap-3">
          <button
            type="button"
            onClick={() => {
              if (!whatsappUrl) return;
              window.open(whatsappUrl, '_blank');
            }}
            disabled={!canOpenWhatsApp || whatsappLoading || !whatsappUrl}
            className="inline-flex items-center justify-center rounded-xl bg-brand-primary px-4 py-2.5 text-sm font-semibold text-text-inverse hover:bg-brand-primaryHover disabled:cursor-not-allowed disabled:opacity-50"
            aria-busy={whatsappLoading}
          >
            Open WhatsApp
          </button>
          {!canOpenWhatsApp && (
            <p className="text-xs text-text-secondary">
              WhatsApp is disabled after the slot time passes or once the booking is no longer
              pending.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function CustomerSalonBookingsPage() {
  const params = useParams<Params>();
  const salonSlug = params?.salonSlug ?? '';
  const router = useRouter();

  const [history, setHistory] = useState<BookingWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<BookingWithDetails | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!salonSlug) {
      setLoading(false);
      return;
    }

    (async () => {
      try {
        setLoading(true);
        setError(null);
        const res = await fetch('/api/customer/bookings', {
          credentials: 'include',
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          if (!cancelled) setError(json.error || 'Failed to load bookings');
          return;
        }
        const all: BookingWithDetails[] = json.data || [];
        const filtered = all.filter((b) => {
          const link = b.salon?.booking_link;
          const businessId = b.business_id;
          return link === salonSlug || businessId === salonSlug;
        });
        if (!cancelled) {
          filtered.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
          setHistory(filtered);
        }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load bookings');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [salonSlug]);

  useEffect(() => {
    if (!selectedBooking) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSelectedBooking(null);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [selectedBooking]);

  const hasHistory = history.length > 0;

  const heading = useMemo(
    () => (hasHistory ? 'Your bookings at this salon' : 'Bookings'),
    [hasHistory]
  );

  const salonName = history?.[0]?.salon?.salon_name || 'Salon';

  const breadcrumbItems = useMemo(
    () => [
      { label: 'My Activity', href: '/customer/dashboard' },
      { label: salonName, href: `/customer/bookings/${salonSlug}` },
    ],
    [salonName, salonSlug]
  );

  return (
    <div className="w-full pb-24 flex flex-col gap-6">
      <Breadcrumb items={breadcrumbItems} />

      <div className="bg-surface-card border border-border-primary rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className={CUSTOMER_SCREEN_TITLE_CLASSNAME}>{heading}</h2>
            {salonSlug && (
              <button
                type="button"
                onClick={() => {
                  const booking = history?.[0];
                  const businessId = booking?.business_id || salonSlug;
                  if (booking?.customer_name || booking?.customer_phone) {
                    setRebookData(booking.customer_name ?? '', booking.customer_phone ?? '');
                  }
                  router.push(`/customer/book/${encodeURIComponent(businessId)}?rebook=true`);
                }}
                className="inline-flex items-center justify-center rounded-lg border border-border-primary bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-card focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-1"
              >
                {UI_CUSTOMER.REBOOK}
              </button>
            )}
          </div>
          {hasHistory && (
            <span className="text-xs text-text-secondary">
              {history.length} past booking{history.length === 1 ? '' : 's'}
            </span>
          )}
        </div>

        {loading ? (
          <div className="py-10 text-center text-sm text-text-secondary">
            Loading booking history…
          </div>
        ) : error ? (
          <div className="py-10 text-center text-sm text-state-error">{error}</div>
        ) : !hasHistory ? (
          <div className="py-10 text-center text-sm text-text-secondary">
            You don&apos;t have any bookings at this salon yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-border-primary text-sm">
              <thead className="bg-surface-elevated">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary w-[10rem]">
                    Booking date
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary w-[12rem]">
                    Booking ID
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary w-[9rem]">
                    Slot time
                  </th>
                  <th className="px-4 py-2.5 text-left font-medium text-text-secondary w-[8rem]">
                    Status
                  </th>
                  <th className="px-4 py-2.5 text-right font-medium text-text-secondary w-[9rem]">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary bg-surface-card">
                {history.map((booking) => (
                  <tr key={booking.id} className="hover:bg-surface-elevated/70 transition-colors">
                    <td className="px-4 py-2.5 text-text-primary">
                      {booking.slot?.date
                        ? formatDate(booking.slot.date)
                        : new Date(booking.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary font-mono break-all">
                      {booking.booking_id}
                    </td>
                    <td className="px-4 py-2.5 text-text-secondary">
                      {booking.slot
                        ? `${formatTime(booking.slot.start_time)} – ${formatTime(booking.slot.end_time)}`
                        : ' '}
                    </td>
                    <td className="px-4 py-2.5">
                      <span
                        className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${getStatusBadgeClass(booking)}`}
                      >
                        {getStatusLabel(booking)}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      <button
                        type="button"
                        onClick={() => setSelectedBooking(booking)}
                        className="inline-flex items-center justify-center rounded-lg border border-border-primary bg-surface-elevated px-3 py-1.5 text-xs font-medium text-text-primary hover:bg-surface-card focus:outline-none focus:ring-2 focus:ring-border-focus focus:ring-offset-1"
                      >
                        {UI_CUSTOMER.VIEW_DETAILS}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedBooking && (
        <BookingDetailModal booking={selectedBooking} onClose={() => setSelectedBooking(null)} />
      )}
    </div>
  );
}
