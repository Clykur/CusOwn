'use client';

import { useEffect, useMemo, memo } from 'react';
import { createPortal } from 'react-dom';
import {
  X,
  Calendar,
  Clock,
  User,
  Phone,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
} from 'lucide-react';
import { formatDate, formatTime } from '@cusown/shared';
import type { BookingWithDetails } from '@cusown/shared';
import StarRating from '@/components/booking/star-rating';
import { cn } from '@cusown/shared';

interface OwnerBookingDetailsModalProps {
  booking: BookingWithDetails | null;
  onClose: () => void;
}

function OwnerBookingDetailsModalComponent({ booking, onClose }: OwnerBookingDetailsModalProps) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const slotDate = useMemo(() => {
    if (!booking?.slot?.date) return '—';
    return formatDate(booking.slot.date);
  }, [booking?.slot?.date]);

  const slotTime = useMemo(() => {
    if (!booking?.slot?.start_time || !booking?.slot?.end_time) return '—';
    return `${formatTime(booking.slot.start_time)} – ${formatTime(booking.slot.end_time)}`;
  }, [booking?.slot?.start_time, booking?.slot?.end_time]);

  if (!booking) return null;

  const statusLabel = booking.status.charAt(0).toUpperCase() + booking.status.slice(1);

  // Status colors
  const statusStyles =
    {
      pending: 'border-amber-500/20 bg-amber-500/10 text-amber-400',
      confirmed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400',
      rejected: 'border-rose-500/20 bg-rose-500/10 text-rose-400',
      cancelled: 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
    }[booking.status] || 'border-zinc-500/20 bg-zinc-500/10 text-zinc-400';

  const formatPrice = (cents: number | null | undefined) => {
    if (cents == null) return '—';
    return `₹${cents / 100}`;
  };

  const modalContent = (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-background-primary/80 p-4 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-border-primary bg-surface-modal p-6 shadow-2xl transition-all"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-6 flex items-center justify-between border-b border-border-primary pb-4">
          <div>
            <h2 className="text-lg font-bold text-text-primary">Booking Details</h2>
            <p className="mt-0.5 font-mono text-xs text-text-tertiary">ID: {booking.booking_id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-text-secondary transition hover:bg-surface-elevated hover:text-text-primary focus:outline-none"
            aria-label="Close details"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Status Section */}
        <div className={cn('mb-6 flex items-center gap-3 rounded-xl border p-4', statusStyles)}>
          {booking.status === 'confirmed' && <CheckCircle className="h-5 w-5 shrink-0" />}
          {booking.status === 'pending' && <Clock className="h-5 w-5 shrink-0" />}
          {booking.status === 'rejected' && <XCircle className="h-5 w-5 shrink-0" />}
          {booking.status === 'cancelled' && <AlertTriangle className="h-5 w-5 shrink-0" />}
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider">{statusLabel}</p>
            <p className="mt-0.5 text-xs opacity-90">
              {booking.status === 'cancelled' && booking.cancelled_by
                ? `Cancelled by ${booking.cancelled_by}`
                : booking.status === 'confirmed' && booking.no_show
                  ? 'Marked as No-Show'
                  : `Booking is ${booking.status}`}
            </p>
          </div>
        </div>

        {/* Grid Info */}
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Customer Card */}
          <div className="rounded-xl border border-border-primary bg-surface-card p-4">
            <div className="mb-3 flex items-center gap-2 border-b border-border-secondary pb-2">
              <User className="h-4 w-4 text-brand-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Customer Information
              </h3>
            </div>
            <p className="text-base font-semibold text-text-primary">{booking.customer_name}</p>
            <div className="mt-2 flex items-center gap-1.5 text-sm text-text-secondary">
              <Phone className="h-3.5 w-3.5" />
              <a
                href={`tel:${booking.customer_phone}`}
                className="hover:text-brand-primary hover:underline"
              >
                {booking.customer_phone}
              </a>
            </div>
          </div>

          {/* Appointment Card */}
          <div className="rounded-xl border border-border-primary bg-surface-card p-4">
            <div className="mb-3 flex items-center gap-2 border-b border-border-secondary pb-2">
              <Calendar className="h-4 w-4 text-brand-primary" />
              <h3 className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
                Appointment Schedule
              </h3>
            </div>
            <div className="space-y-1.5 text-sm text-text-primary">
              <div className="flex justify-between">
                <span className="text-text-secondary">Date:</span>
                <span className="font-medium">{slotDate}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-text-secondary">Time Slot:</span>
                <span className="font-medium">{slotTime}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Business details if available */}
        {booking.salon && (
          <div className="mt-4 rounded-xl border border-border-primary bg-surface-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Business Location
            </h3>
            <p className="text-sm font-semibold text-text-primary">{booking.salon.salon_name}</p>
            {booking.salon.address && (
              <p className="mt-1 text-xs text-text-secondary">{booking.salon.address}</p>
            )}
          </div>
        )}

        {/* Services List */}
        <div className="mt-4 rounded-xl border border-border-primary bg-surface-card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-text-secondary">
            Booked Services
          </h3>
          <div className="divide-y divide-border-secondary">
            {booking.services && booking.services.length > 0 ? (
              booking.services.map((service: any) => (
                <div
                  key={service.id}
                  className="flex justify-between py-2 text-sm first:pt-0 last:pb-0"
                >
                  <span className="text-text-primary font-medium">{service.name}</span>
                  <div className="text-right text-text-secondary">
                    <span>{service.duration_minutes} mins</span>
                    {service.price_cents != null && (
                      <span className="ml-3 font-semibold text-text-primary">
                        {formatPrice(service.price_cents)}
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="flex justify-between py-1 text-sm">
                <span className="text-text-primary font-medium">
                  {booking.service_name || 'Standard Service'}
                </span>
                {booking.total_duration_minutes != null && (
                  <span className="text-text-secondary">{booking.total_duration_minutes} mins</span>
                )}
              </div>
            )}
          </div>

          {/* Pricing & Duration Summary */}
          <div className="mt-4 border-t border-border-secondary pt-3 flex justify-between text-sm font-semibold text-text-primary">
            <div>
              <span className="text-text-secondary font-normal">Total Duration:</span>{' '}
              {booking.total_duration_minutes || booking.slot?.start_time ? (
                <span>
                  {booking.total_duration_minutes ??
                    (booking.slot
                      ? Math.round(
                          (new Date(`2000-01-01T${booking.slot.end_time}`).getTime() -
                            new Date(`2000-01-01T${booking.slot.start_time}`).getTime()) /
                            60000
                        )
                      : 30)}{' '}
                  mins
                </span>
              ) : (
                '—'
              )}
            </div>
            <div>
              <span className="text-text-secondary font-normal">Total Value:</span>{' '}
              <span className="text-brand-primary">{formatPrice(booking.total_price_cents)}</span>
            </div>
          </div>
        </div>

        {/* Reviews section */}
        {booking.review && (
          <div className="mt-4 rounded-xl border border-border-primary bg-surface-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-text-secondary">
              Customer Feedback
            </h3>
            <div className="flex items-center gap-2">
              <StarRating value={booking.review.rating} readonly size="sm" />
              <span className="text-xs font-medium text-text-secondary">
                ({booking.review.rating} out of 5)
              </span>
            </div>
            {booking.review.comment && (
              <p className="mt-2 text-sm italic text-text-secondary bg-surface-elevated rounded-lg p-3">
                &quot;{booking.review.comment}&quot;
              </p>
            )}
          </div>
        )}

        {/* Reschedule Metadata */}
        {(booking.reschedule_count ?? 0) > 0 && (
          <div className="mt-4 rounded-xl border border-border-primary bg-surface-card p-4 text-xs text-text-secondary flex items-start gap-2">
            <RefreshCw className="h-4 w-4 shrink-0 text-brand-primary" />
            <div>
              <span className="font-semibold text-text-primary">
                Rescheduled {booking.reschedule_count} times.
              </span>
              {booking.reschedule_reason && (
                <p className="mt-1">Reason: &quot;{booking.reschedule_reason}&quot;</p>
              )}
            </div>
          </div>
        )}

        {/* Audit Log / Timestamps */}
        <div className="mt-6 border-t border-border-secondary pt-4 text-center text-[10px] text-text-tertiary">
          <span>Created on {new Date(booking.created_at).toLocaleString()}</span>
          {booking.updated_at !== booking.created_at && (
            <span className="ml-4">
              Last updated {new Date(booking.updated_at).toLocaleString()}
            </span>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
}

export const OwnerBookingDetailsModal = memo(OwnerBookingDetailsModalComponent);
export default OwnerBookingDetailsModal;
