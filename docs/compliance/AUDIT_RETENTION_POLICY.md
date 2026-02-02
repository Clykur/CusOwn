# Audit Retention Policy

## Purpose

Audit logs support security investigations, compliance, and support ("why was booking cancelled, who triggered it, when"). This policy defines retention and handling so logs remain compliance-ready.

## Retention

- **Default retention**: 90 days (configurable via `AUDIT_RETENTION_DAYS`).
- Logs older than the retention period may be purged by a scheduled job or manual process.
- Purge process must be documented and logged.

## What We Store

- **Entity**: `entity_type`, `entity_id` (e.g. booking ID, payment ID).
- **Action**: `action_type` (e.g. booking_confirmed, payment_succeeded).
- **Actor**: `admin_user_id` (null for system actions).
- **Change data**: `old_data` / `new_data` — **PII-minimized** (known PII keys redacted before insert).
- **Request metadata**: `ip_address`, `user_agent` (for abuse investigation; optional per jurisdiction).

## PII Minimization

- Structured lifecycle logs (Phase 4) use only IDs (booking_id, slot_id) — no PII.
- Audit `old_data` / `new_data` are passed through `redactPiiForAudit()` before insert. Known PII keys (e.g. customer_name, customer_phone, email) are redacted to avoid storing PII in audit logs.

## Compliance Readiness

- Every state-changing action on bookings and payments is audited.
- Admin support can answer "why / who / when" via `GET /api/admin/bookings/[id]/lifecycle` and audit log queries.
- Retention period and purge process should be aligned with local regulations (e.g. GDPR, PCI) where applicable.
