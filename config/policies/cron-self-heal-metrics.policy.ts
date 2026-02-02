/**
 * Phase 3 Self-Healing — Locked scope.
 * Builds on Phase 1–2. All existing invariants immutable.
 *
 * OBJECTIVE: Booking/slot correctness even with missed cron; system self-heals on user interaction.
 *
 * SCOPE (LOCKED):
 * - Lazy expiration on booking read/mutation (same RPC, transactional, idempotent, audit).
 * - Metrics: expired_by_cron, expired_by_lazy_heal; cron last run timestamp for alerting.
 * - RPC safe for concurrent calls (FOR UPDATE in expire RPC).
 *
 * EXIT CRITERIA:
 * - No stuck pending bookings (cron or lazy heal).
 * - Cron failure does not corrupt system state.
 */

export const PHASE3_LAZY_EXPIRE_SOURCE_CRON = 'cron' as const;
export const PHASE3_LAZY_EXPIRE_SOURCE_LAZY_HEAL = 'lazy_heal' as const;
export const PHASE3_SCOPE_LOCKED = true;
