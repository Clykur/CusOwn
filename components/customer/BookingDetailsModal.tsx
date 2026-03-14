'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useOptimisticMutation } from '@/lib/hooks/use-optimistic-action';
import { UI_CUSTOMER } from '@/config/constants';
import { formatDate, formatTime } from '@/lib/utils/string';
import { BookingWithDetails, Slot } from '@/types';
import dynamic from 'next/dynamic';
import { BookingActions } from '@/components/booking/booking-status/booking-actions';

const RescheduleButton = dynamic(() => import('@/components/booking/reschedule-button'), {
  ssr: false,
});

const ALLOWED_STATUSES = ['pending', 'confirmed', 'rejected', 'cancelled'] as const;
type AllowedStatus = (typeof ALLOWED_STATUSES)[number];

function normalizeStatus(status: string): AllowedStatus {
  return ALLOWED_STATUSES.includes(status as AllowedStatus) ? (status as AllowedStatus) : 'pending';
}

function getStatusLabel(booking: BookingWithDetails): string {
  const status = normalizeStatus(booking.status);

  switch (status) {
    case 'confirmed':
      return 'Confirmed';
    case 'pending':
      return 'Pending';
    case 'rejected':
      return 'Rejected';
    case 'cancelled':
      return 'Cancelled';
    default:
      return 'Pending';
  }
}

export interface BookingDetailsModalProps {
  booking: BookingWithDetails;
  cancellationMinHoursMs: number;
  onCancelled: () => void;
  onRescheduled: () => void;
  onClose: () => void;
}

export default function BookingDetailsModal({
  booking,
  cancellationMinHoursMs,
  onCancelled,
  onRescheduled,
  onClose,
}: BookingDetailsModalProps) {
  const salonId = booking.salon?.id ?? booking.business_id;

  const slotDate = booking.slot?.date ? formatDate(booking.slot.date) : null;

  const slotTime =
    booking.slot?.start_time && booking.slot?.end_time
      ? `${formatTime(booking.slot.start_time)} – ${formatTime(booking.slot.end_time)}`
      : null;

  const [whatsappUrl, setWhatsappUrl] = useState<string | null>(null);
  const [whatsappLoading, setWhatsappLoading] = useState(false);
  const [optimisticStatus, setOptimisticStatus] = useState<string | null>(null);

  const showCancelled = optimisticStatus === 'cancelled';

  const canCancelByStatus = booking.status === 'confirmed' || booking.status === 'pending';

  const appointmentDateTime = (() => {
    if (!booking?.slot?.date || !booking?.slot?.start_time) return null;

    const startTimeRaw = String(booking.slot.start_time);

    const startTime = startTimeRaw.includes('T')
      ? new Date(startTimeRaw)
      : new Date(`${booking.slot.date}T${startTimeRaw}`);

    const timeMs = startTime.getTime();

    if (!Number.isFinite(timeMs)) return null;

    return startTime;
  })();

  const msUntilAppointment = appointmentDateTime
    ? appointmentDateTime.getTime() - Date.now()
    : Number.POSITIVE_INFINITY;

  const isCancellationTooLate =
    canCancelByStatus &&
    Number.isFinite(msUntilAppointment) &&
    msUntilAppointment < cancellationMinHoursMs;

  const cancelMutation = useOptimisticMutation({
    mutationFn: async () => {
      const { getCSRFToken } = await import('@/lib/utils/csrf-client');

      const csrfToken = await getCSRFToken();

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };

      if (csrfToken) {
        headers['x-csrf-token'] = csrfToken;
      }

      const response = await fetch(`/api/bookings/${booking.id}/cancel`, {
        method: 'POST',
        headers,
        credentials: 'include',
        body: JSON.stringify({ cancelled_by: 'customer' }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to cancel booking');
      }

      return result;
    },

    onMutate: () => {
      setOptimisticStatus('cancelled');
    },

    onSuccess: () => {
      onCancelled();
    },

    onError: () => {
      setOptimisticStatus(null);
    },
  });

  const handleCancel = useCallback(async () => {
    if (cancelMutation.isPending) return;

    if (isCancellationTooLate) return;

    if (!confirm('Are you sure you want to cancel this booking?')) return;

    try {
      await cancelMutation.mutate(undefined);
    } catch {}
  }, [cancelMutation, isCancellationTooLate]);

  /* ---------------- SLOT FETCHING ---------------- */

  /* ---------------- SLOT FETCHING ---------------- */

  const [slots, setSlots] = useState<Slot[]>([]);

  useEffect(() => {
    let cancelled = false;

    const date = booking.slot?.date;

    if (!salonId || !date) return;

    (async () => {
      try {
        const params = new URLSearchParams({
          salon_id: String(salonId),
          date,
          status: 'available',
        });

        const res = await fetch(`/api/slots?${params}`, {
          credentials: 'include',
        });

        const json = await res.json();

        if (!cancelled && res.ok && json?.success) {
          const slotData = Array.isArray(json.data) ? json.data : json.data?.slots || [];

          setSlots(slotData);
        }
      } catch {
        if (!cancelled) setSlots([]);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [salonId, booking.slot?.date]);

  /* ---------------- SLOT TIME CHECK ---------------- */

  const slotStart = useMemo(() => {
    if (!booking.slot?.date || !booking.slot?.start_time) return null;

    const startTimeRaw = String(booking.slot.start_time);

    const d = startTimeRaw.includes('T')
      ? new Date(startTimeRaw)
      : new Date(`${booking.slot.date}T${startTimeRaw}`);

    return Number.isFinite(d.getTime()) ? d : null;
  }, [booking.slot?.date, booking.slot?.start_time]);

  const slotTimeExpired = useMemo(() => {
    if (!slotStart) return false;
    return slotStart.getTime() <= Date.now();
  }, [slotStart]);

  const cancelledByCustomer = booking.status === 'cancelled' && booking.cancelled_by === 'customer';

  const disableWhatsApp = slotTimeExpired || cancelledByCustomer;

  /* ---------------- WHATSAPP LINK ---------------- */

  useEffect(() => {
    let cancelled = false;

    if (disableWhatsApp) {
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
  }, [booking.booking_id, disableWhatsApp]);

  /* ---------------- ESC CLOSE ---------------- */

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    window.addEventListener('keydown', handler);

    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  /* ---------------- UI ---------------- */

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200/80 bg-white px-5 pt-6 pb-10 sm:px-6 shadow-sm"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}

        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">{UI_CUSTOMER.VIEW_DETAILS}</h2>

            <p className="mt-0.5 text-sm text-slate-500">Booking details</p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded p-2 text-slate-500 hover:bg-slate-100"
          >
            <span className="text-xl leading-none">&times;</span>
          </button>
        </div>

        {/* Status */}

        <div className="mb-5 rounded-xl border-2 px-5 py-4">
          <p className="font-bold text-base">{getStatusLabel(booking)}</p>

          {slotDate && slotTime && (
            <p className="mt-1 text-sm opacity-90">
              {slotDate} · {slotTime}
            </p>
          )}
        </div>

        {/* Customer */}

        <div className="grid gap-4 sm:grid-cols-2 mb-4">
          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Customer</p>

            <p className="text-sm text-slate-700">{booking.customer_name}</p>

            <a
              href={`tel:${booking.customer_phone}`}
              className="text-sm text-blue-600 hover:underline"
            >
              {booking.customer_phone}
            </a>
          </div>

          <div className="rounded-xl border bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase text-slate-500 mb-2">
              Appointment details
            </p>

            <p className="text-sm">Booking ID: {booking.booking_id}</p>

            <p className="text-sm">Date: {slotDate ?? '—'}</p>

            <p className="text-sm">Slot: {slotTime ?? '—'}</p>
          </div>
        </div>

        <BookingActions
          booking={{
            id: booking.id,
            status: booking.status,
            no_show: booking.no_show,
            slot: booking.slot,
            salon: booking.salon,
            business_id: booking.business_id,
          }}
          availableSlots={slots}
          cancellationMinHoursMs={cancellationMinHoursMs}
          onCancelled={onCancelled}
          onRescheduled={onRescheduled}
        />

        {/* WhatsApp */}

        <div className="mt-6">
          <button
            onClick={() => whatsappUrl && window.open(whatsappUrl, '_blank')}
            disabled={disableWhatsApp || whatsappLoading || !whatsappUrl}
            className="w-full rounded-xl bg-slate-900 px-4 py-2.5 text-white"
          >
            {UI_CUSTOMER.CTA_OPEN_WHATSAPP}
          </button>
        </div>
      </div>
    </div>
  );
}
