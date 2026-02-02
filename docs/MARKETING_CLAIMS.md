# Marketing Claims vs Guarantees

## Purpose

Phase 6: Ensure marketing copy does not overpromise. All user-facing claims should be validatable and aligned with product behaviour.

## Rules

- **No absolute guarantees** unless we can honour them (e.g. avoid "100% uptime", "always", "never" unless true).
- **Soft claims** (e.g. "Trusted by service businesses", "Set up in minutes") are acceptable as long as they are not false.
- **"Designed to grow with you"** (landing) — preferred over "built to scale" to avoid implying scaling guarantees we do not commit to.
- **Refunds and cancellations** — see `docs/compliance/CANCELLATION_REFUND_POLICY.md`. Do not promise automatic refunds unless the product does so.

## Where we validate

- **Landing page** (`app/page.tsx`) — hero, trust indicators, feature bullets.
- **Setup/onboarding** — avoid "guaranteed" or "instant" unless true.
- **Support or FAQ copy** — align with runbooks and compliance docs.

## Review

When adding or changing marketing copy, check:

1. Can we deliver what we say?
2. Do we have a runbook or policy that backs the claim?
3. If something goes wrong, is the user experience still correct (no dark state)?
