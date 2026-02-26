'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ROUTES, getAdminDashboardUrl } from '@/lib/utils/navigation';
import { AdminDashboardSkeleton } from '@/components/ui/skeleton';
import { AdminSectionWrapper } from '@/components/admin/admin-section-wrapper';

export default function AdminBookingPage() {
  const router = useRouter();
  const params = useParams();
  const bookingId = params?.id as string;

  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);

  const loadBooking = useCallback(async () => {
    try {
      const sessionRes = await fetch('/api/auth/session', { credentials: 'include' });
      const sessionJson = await sessionRes.json();
      if (!sessionRes.ok || !sessionJson?.data?.user) {
        router.push(ROUTES.AUTH_LOGIN(ROUTES.ADMIN_BOOKING(bookingId)));
        return;
      }

      const res = await fetch(`/api/admin/bookings/${bookingId}`, {
        credentials: 'include',
      });

      if (!res.ok) {
        if (res.status === 404) {
          setError('Booking not found');
        } else if (res.status === 403) {
          setError('You do not have permission to view this booking');
        } else {
          setError('Failed to load booking');
        }
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (data.success) {
        setBooking(data.data);
      } else {
        setError(data.error || 'Failed to load booking');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load booking');
    } finally {
      setLoading(false);
    }
  }, [bookingId, router]);

  useEffect(() => {
    loadBooking();
  }, [loadBooking]);

  const handleAction = async (action: 'accept' | 'reject' | 'cancel', reason?: string) => {
    if (!booking) return;

    setActionLoading(true);
    try {
      let endpoint = '';
      let body: Record<string, string> = {};

      if (action === 'accept') {
        endpoint = `/api/bookings/${bookingId}/accept`;
      } else if (action === 'reject') {
        endpoint = `/api/bookings/${bookingId}/reject`;
        body = { reason: reason || 'Rejected by admin' };
      } else if (action === 'cancel') {
        endpoint = `/api/bookings/${bookingId}/cancel`;
        body = { reason: reason || 'Cancelled by admin' };
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (data.success) {
        // Optimistic local state update
        setBooking((prev: any) => ({
          ...prev,
          status:
            action === 'accept' ? 'confirmed' : action === 'reject' ? 'rejected' : 'cancelled',
          ...(action === 'cancel'
            ? {
                cancelled_at: new Date().toISOString(),
                cancellation_reason: reason || 'Cancelled by admin',
              }
            : {}),
          ...(action === 'reject' ? { cancellation_reason: reason || 'Rejected by admin' } : {}),
        }));
      } else {
        setError(data.error || `Failed to ${action} booking`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to ${action} booking`);
    } finally {
      setActionLoading(false);
    }
  };

  const bookingsUrl = getAdminDashboardUrl('bookings');

  if (loading) {
    return <AdminDashboardSkeleton />;
  }

  if (error && !booking) {
    return (
      <AdminSectionWrapper title="Error" subtitle={error}>
        <div className="flex justify-center py-6">
          <button
            onClick={() => router.push(ROUTES.ADMIN_DASHBOARD)}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
          >
            Back to Dashboard
          </button>
        </div>
      </AdminSectionWrapper>
    );
  }

  if (!booking) return null;

  const displayId = booking.booking_id || booking.id?.toString().slice(0, 8) || '—';
  const status = (booking.status || '').toLowerCase();

  return (
    <>
      <div className="mb-6">
        <button
          onClick={() => router.push(bookingsUrl)}
          className="text-slate-600 hover:text-slate-900 mb-4 text-sm font-medium"
        >
          ← Back to Bookings
        </button>
        <h2 className="text-xl font-semibold text-slate-900 tracking-tight">Booking Details</h2>
        <p className="mt-0.5 text-sm text-slate-500">View and manage this booking</p>
      </div>

      <div className="space-y-8">
        <AdminSectionWrapper
          title="Booking"
          subtitle={`ID ${displayId} · Created ${new Date(booking.created_at).toLocaleString()}`}
        >
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <div>
              <p className="text-sm text-slate-500 mb-1.5">Status</p>
              <span
                className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${
                  status === 'confirmed'
                    ? 'bg-emerald-100 text-emerald-800'
                    : status === 'rejected' || status === 'cancelled'
                      ? 'bg-red-100 text-red-800'
                      : status === 'pending'
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-slate-100 text-slate-800'
                }`}
              >
                {booking.status}
              </span>
            </div>
            {booking.slot && (
              <div>
                <p className="text-sm text-slate-500 mb-1.5">Date & time</p>
                <p className="text-sm font-medium text-slate-900">
                  {new Date(booking.slot.date).toLocaleDateString()}
                  {booking.slot.start_time
                    ? ` · ${booking.slot.start_time}${booking.slot.end_time ? ` – ${booking.slot.end_time}` : ''}`
                    : ''}
                </p>
              </div>
            )}
          </div>
        </AdminSectionWrapper>

        <AdminSectionWrapper title="Customer" subtitle="Customer information">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-500 mb-0.5">Name</p>
              <p className="text-sm font-medium text-slate-900">{booking.customer_name || '—'}</p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-0.5">Phone</p>
              <p className="text-sm font-medium text-slate-900">{booking.customer_phone || '—'}</p>
            </div>
            {booking.customer_user_id && (
              <div>
                <p className="text-sm text-slate-500 mb-0.5">User ID</p>
                <p className="text-sm font-mono text-slate-700">
                  {booking.customer_user_id.substring(0, 8)}…
                </p>
              </div>
            )}
          </div>
        </AdminSectionWrapper>

        <AdminSectionWrapper title="Business" subtitle="Business information">
          <div className="space-y-4">
            <div>
              <p className="text-sm text-slate-500 mb-0.5">Business</p>
              <p className="text-sm font-medium text-slate-900">
                {booking.business?.salon_name || booking.business?.name || 'N/A'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-0.5">Location</p>
              <p className="text-sm font-medium text-slate-900">
                {booking.business?.location || '—'}
              </p>
            </div>
            <div>
              <p className="text-sm text-slate-500 mb-0.5">Phone</p>
              <p className="text-sm font-medium text-slate-900">
                {booking.business?.whatsapp_number || '—'}
              </p>
            </div>
          </div>
        </AdminSectionWrapper>

        <AdminSectionWrapper title="Actions" subtitle="Accept, reject or cancel">
          <div className="flex flex-wrap gap-3">
            {booking.status === 'pending' && (
              <>
                <button
                  onClick={() => handleAction('accept')}
                  disabled={actionLoading}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing…' : 'Accept Booking'}
                </button>
                <button
                  onClick={() => {
                    const reason = prompt('Rejection reason (optional):');
                    if (reason !== null) handleAction('reject', reason);
                  }}
                  disabled={actionLoading}
                  className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-50"
                >
                  {actionLoading ? 'Processing…' : 'Reject Booking'}
                </button>
              </>
            )}
            {booking.status === 'confirmed' && (
              <button
                onClick={() => {
                  const reason = prompt('Cancellation reason (optional):');
                  if (reason !== null) handleAction('cancel', reason);
                }}
                disabled={actionLoading}
                className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-medium text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-50"
              >
                {actionLoading ? 'Processing…' : 'Cancel Booking'}
              </button>
            )}
            {(booking.status === 'cancelled' || booking.status === 'rejected') && (
              <p className="text-sm text-slate-500">No actions available</p>
            )}
          </div>
        </AdminSectionWrapper>

        {booking.cancellation_reason && (
          <AdminSectionWrapper title="Cancellation" subtitle="Reason and date">
            <div className="rounded-xl border border-red-200 bg-red-50/50 py-4 px-4">
              <p className="text-sm font-medium text-red-800">{booking.cancellation_reason}</p>
              {booking.cancelled_at && (
                <p className="mt-1 text-xs text-red-600">
                  Cancelled on {new Date(booking.cancelled_at).toLocaleString()}
                </p>
              )}
            </div>
          </AdminSectionWrapper>
        )}
      </div>
    </>
  );
}
