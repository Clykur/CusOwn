/**
 * Phase 1 Production Hardening — Locked scope and PO decisions.
 * Do not change without Product Owner and Technical Lead approval.
 *
 * APPROVED ASSUMPTIONS:
 * - Booking–slot consistency: one slot → at most one confirmed booking (DB-enforced).
 * - Booking lifecycle: state machine (pending → confirm | reject | cancel | expire) only.
 * - Cancellation/expiry: customer/owner cancel within policy; system expire via cron only.
 *
 * PAYMENT–BOOKING POLICY (Product Owner decision):
 * - Option A (locked): Payment optional. Booking can be confirmed without payment.
 * - No new coupling between payment and booking for Phase 1.
 *
 * NON-NEGOTIABLES:
 * - No public /api/bookings/expire; cron-only with CRON_SECRET.
 * - Expire must be transactional (booking + slot in one DB transaction).
 * - Accept / reject / cancel must be idempotent (repeat request → same result).
 * - All booking state changes must be audited (including system expire).
 *
 * PHASE 1 CHECKLIST:
 * [x] Protect /api/bookings/expire with CRON_SECRET
 * [x] Transactional expire (RPC expire_pending_bookings_atomically)
 * [x] Idempotent accept/reject/cancel at API layer
 * [x] Audit for cancel (existing) and system expire
 * [x] DB: partial unique index one confirmed booking per slot
 */

export const PHASE1_PAYMENT_BOOKING_POLICY = 'optional' as const;
export const PHASE1_SCOPE_LOCKED = true;
