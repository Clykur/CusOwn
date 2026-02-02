# Cancellation and Refund Policy (Reference)

This document describes the **technical and product policy** used for validation and support. No product behaviour is changed by this document; it validates existing constants and behaviour.

## Cancellation

- **Customer/Owner cancellation**: Allowed when the booking is in a cancellable state. Business rule: cancellation must be at least **2 hours** before the appointment (configurable via `CANCELLATION_MIN_HOURS_BEFORE` / `env.booking.cancellationMinHoursBefore`).
- **System cancellation**: Pending bookings expire after **24 hours** (configurable via `BOOKING_EXPIRY_HOURS` / cron). Expired bookings are cancelled by the system and slots released.
- **Validation**: `CANCELLATION_MIN_HOURS_BEFORE` is used in the booking/cancel flow to reject late cancellations; error message: `CANCELLATION_TOO_LATE`.

## Refunds

- **Policy**: Refunds follow payment provider (Razorpay/UPI) policy and business discretion. The platform does not auto-refund on cancellation; payment state is decoupled from booking state (Phase 2).
- **Reference**: See `REFUND_POLICY_NOTE` in `config/constants.ts` for in-app/support reference.

## Validation

- Cancellation window is enforced in code using `CANCELLATION_MIN_HOURS_BEFORE`.
- Refund handling is out of scope of booking state machine; support and business handle refunds per provider and policy.
