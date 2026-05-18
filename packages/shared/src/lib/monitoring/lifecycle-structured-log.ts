/**
 * Phase 4: Structured lifecycle logs for booking and payment.
 * JSON to stdout so log aggregators can parse (booking_id, slot_id, action, actor, source).
 */

export type BookingLifecycleAction =
  | 'booking_created'
  | 'booking_confirmed'
  | 'booking_rejected'
  | 'booking_undo_accept'
  | 'booking_undo_reject'
  | 'booking_cancelled';

export type BookingLifecycleSource = 'api' | 'cron' | 'lazy_heal';

export interface BookingLifecyclePayload {
  booking_id: string;
  slot_id: string;
  action: BookingLifecycleAction;
  actor: string;
  source: BookingLifecycleSource;
  /** Optional: cancellation_reason, etc. */
  reason?: string;
  timestamp: string;
}

export type PaymentLifecycleAction = 'payment_created' | 'payment_succeeded' | 'payment_failed';

export interface PaymentLifecyclePayload {
  payment_id: string;
  booking_id: string;
  action: PaymentLifecycleAction;
  actor: string;
  reason?: string;
  timestamp: string;
}

const PREFIX_BOOKING = '[LIFECYCLE_BOOKING]';
const PREFIX_PAYMENT = '[LIFECYCLE_PAYMENT]';

export function logBookingLifecycle(payload: Omit<BookingLifecyclePayload, 'timestamp'>): void {
  const line = JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
  });
  console.log(`${PREFIX_BOOKING} ${line}`);
}

export function logPaymentLifecycle(payload: Omit<PaymentLifecyclePayload, 'timestamp'>): void {
  const line = JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
  });
  console.log(`${PREFIX_PAYMENT} ${line}`);
}
