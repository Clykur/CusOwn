# CusOwn Security & Schema Audit Report

**Date:** 2026-01-26  
**Auditor:** Senior Backend Architect + Security Specialist  
**Scope:** Full codebase vs. database schema consistency, security, abuse resistance

---

## EXECUTIVE SUMMARY

**Security Confidence Score: 7/10** ⚠️

**Critical Findings:**

- 🔴 **CRITICAL**: Booking creation lacks atomic transaction (race condition risk)
- 🔴 **CRITICAL**: Slot reservation not using state machine validation
- 🔴 **CRITICAL**: Payment state machine exists but not enforced in all payment operations
- 🟠 **HIGH**: Some schema columns unused or partially used
- 🟠 **HIGH**: Missing transaction safety in booking confirmation (outside payment flow)
- 🟡 **MEDIUM**: Inconsistent RBAC enforcement patterns
- 🟡 **MEDIUM**: Some audit logging gaps

---

## PART 1: SCHEMA ↔ CODE CONSISTENCY

### Table Usage Matrix

| Table                      | Status     | Usage                              | Issues                              |
| -------------------------- | ---------- | ---------------------------------- | ----------------------------------- |
| `audit_logs`               | ✅ Used    | `auditService.createAuditLog()`    | ⚠️ Not all mutations logged         |
| `booking_reminders`        | ✅ Used    | `reminderService`                  | ✅ Fully utilized                   |
| `booking_services`         | ✅ Used    | `bookingService.createBooking()`   | ✅ Fully utilized                   |
| `bookings`                 | ✅ Used    | Core table                         | ⚠️ See column analysis below        |
| `business_closures`        | ✅ Used    | `downtimeService`                  | ✅ Fully utilized                   |
| `business_holidays`        | ✅ Used    | `downtimeService`                  | ✅ Fully utilized                   |
| `business_special_hours`   | ✅ Used    | `downtimeService`                  | ✅ Fully utilized                   |
| `businesses`               | ✅ Used    | Core table                         | ⚠️ See column analysis below        |
| `metric_timings`           | ⚠️ Partial | `metricsService.recordTiming()`    | 🟡 Created but not queried          |
| `metrics`                  | ✅ Used    | `metricsService`                   | ✅ Fully utilized                   |
| `notification_history`     | ✅ Used    | `notificationService`              | ✅ Fully utilized                   |
| `notification_preferences` | ✅ Used    | `notificationService`              | ✅ Fully utilized                   |
| `payment_attempts`         | ❌ Unused  | Schema exists                      | 🔴 **DEAD SCHEMA** - Never inserted |
| `payment_audit_logs`       | ✅ Used    | `paymentService.logPaymentAudit()` | ✅ Fully utilized                   |
| `payments`                 | ✅ Used    | Core table                         | ✅ Fully utilized                   |
| `request_nonces`           | ✅ Used    | `nonce-store.ts`                   | ✅ Fully utilized                   |
| `services`                 | ✅ Used    | `serviceService`                   | ✅ Fully utilized                   |
| `slots`                    | ✅ Used    | Core table                         | ⚠️ See column analysis below        |
| `user_profiles`            | ✅ Used    | `userService`                      | ✅ Fully utilized                   |

### Column-Level Analysis

#### `bookings` Table

| Column                        | Schema Rule           | Code Usage       | Issue                                      | Risk |
| ----------------------------- | --------------------- | ---------------- | ------------------------------------------ | ---- |
| `id`                          | UUID PK               | ✅ Used          | -                                          | -    |
| `business_id`                 | UUID NOT NULL         | ✅ Used          | -                                          | -    |
| `slot_id`                     | UUID NOT NULL         | ✅ Used          | -                                          | -    |
| `customer_name`               | TEXT NOT NULL         | ✅ Used          | -                                          | -    |
| `customer_phone`              | TEXT NOT NULL         | ✅ Used          | -                                          | -    |
| `booking_id`                  | TEXT UNIQUE           | ✅ Used          | -                                          | -    |
| `status`                      | TEXT NOT NULL, CHECK  | ✅ Used          | ⚠️ State machine not enforced in all paths | 🟡   |
| `customer_user_id`            | UUID NULL             | ✅ Used          | -                                          | -    |
| `cancelled_by`                | TEXT CHECK            | ✅ Used          | -                                          | -    |
| `cancellation_reason`         | TEXT NULL             | ✅ Used          | -                                          | -    |
| `cancelled_at`                | TIMESTAMP NULL        | ✅ Used          | -                                          | -    |
| `rescheduled_from_booking_id` | UUID NULL             | ✅ Used          | -                                          | -    |
| `rescheduled_at`              | TIMESTAMP NULL        | ✅ Used          | -                                          | -    |
| `rescheduled_by`              | TEXT CHECK            | ✅ Used          | -                                          | -    |
| `reschedule_reason`           | TEXT NULL             | ✅ Used          | -                                          | -    |
| `no_show`                     | BOOLEAN DEFAULT false | ✅ Used          | -                                          | -    |
| `no_show_marked_at`           | TIMESTAMP NULL        | ✅ Used          | -                                          | -    |
| `no_show_marked_by`           | TEXT CHECK            | ✅ Used          | -                                          | -    |
| `total_duration_minutes`      | INTEGER NULL          | ✅ Used          | -                                          | -    |
| `total_price_cents`           | INTEGER NULL          | ✅ Used          | ⚠️ Server-calculated (good)                | -    |
| `services_count`              | INTEGER DEFAULT 1     | ✅ Used          | -                                          | -    |
| `payment_required`            | BOOLEAN DEFAULT false | ⚠️ **NEVER SET** | 🔴 Column exists but never written         | 🔴   |
| `payment_type`                | TEXT CHECK            | ⚠️ **NEVER SET** | 🔴 Column exists but never written         | 🔴   |

#### `businesses` Table

| Column                 | Schema Rule           | Code Usage        | Issue                                         | Risk |
| ---------------------- | --------------------- | ----------------- | --------------------------------------------- | ---- |
| `suspended`            | BOOLEAN DEFAULT false | ❌ **NEVER READ** | 🔴 Suspension check missing in queries        | 🔴   |
| `suspended_at`         | TIMESTAMP NULL        | ❌ **NEVER READ** | 🔴 Suspension check missing                   | 🔴   |
| `suspended_reason`     | TEXT NULL             | ❌ **NEVER READ** | 🔴 Suspension check missing                   | 🔴   |
| `is_location_verified` | BOOLEAN DEFAULT false | ❌ **NEVER READ** | 🟡 Location verification not enforced         | 🟡   |
| `search_radius_km`     | INTEGER DEFAULT 10    | ⚠️ **NEVER READ** | 🟡 Search radius not used in location queries | 🟡   |

#### `slots` Table

| Column           | Schema Rule    | Code Usage | Issue                                       | Risk |
| ---------------- | -------------- | ---------- | ------------------------------------------- | ---- |
| `reserved_until` | TIMESTAMP NULL | ✅ Used    | ⚠️ Expiry check not atomic with reservation | 🟠   |

#### `payments` Table

| Column                   | Schema Rule | Code Usage            | Issue                                             | Risk |
| ------------------------ | ----------- | --------------------- | ------------------------------------------------- | ---- |
| `payment_attempts` table | EXISTS      | ❌ **NEVER INSERTED** | 🔴 Payment failures not tracked in attempts table | 🔴   |

---

## PART 2: STATE MACHINES & TRANSACTION SAFETY

### Booking State Machine

**Status:** ⚠️ **PARTIALLY ENFORCED**

| Transition              | Enforced? | Location                          | Issue                 |
| ----------------------- | --------- | --------------------------------- | --------------------- |
| `pending → confirmed`   | ✅ Yes    | `bookingService.confirmBooking()` | ✅ Uses state machine |
| `pending → rejected`    | ✅ Yes    | `bookingService.rejectBooking()`  | ✅ Uses state machine |
| `pending → cancelled`   | ✅ Yes    | `bookingService.cancelBooking()`  | ✅ Uses state machine |
| `confirmed → cancelled` | ✅ Yes    | `bookingService.cancelBooking()`  | ✅ Uses state machine |

**🔴 CRITICAL ISSUE:** State machine validation exists but booking creation doesn't use it (booking always starts as 'pending', which is correct, but no validation that initial state is valid).

**🟠 HIGH ISSUE:** `confirmBooking()` and `rejectBooking()` are NOT atomic with slot updates. If booking confirmation succeeds but slot booking fails, booking is confirmed but slot remains available.

**Code Evidence:**

```typescript
// services/booking.service.ts:188-224
async confirmBooking(bookingId: string): Promise<Booking> {
  // ... state machine check ...
  await supabaseAdmin.from('bookings').update({ status: 'confirmed' });
  // ❌ NO ATOMIC SLOT UPDATE HERE
  // Slot update happens separately in API route
}
```

### Slot State Machine

**Status:** 🔴 **NOT ENFORCED**

| Transition             | Enforced? | Location                    | Issue                     |
| ---------------------- | --------- | --------------------------- | ------------------------- |
| `available → reserved` | ❌ No     | `slotService.reserveSlot()` | 🔴 No state machine check |
| `reserved → booked`    | ❌ No     | `slotService.bookSlot()`    | 🔴 No state machine check |
| `reserved → available` | ❌ No     | `slotService.releaseSlot()` | 🔴 No state machine check |

**🔴 CRITICAL:** Slot state machine exists but is NEVER used in `slot.service.ts`. All slot transitions bypass state machine validation.

**Code Evidence:**

```typescript
// services/slot.service.ts:323-357
async reserveSlot(slotId: string): Promise<boolean> {
  // ❌ NO STATE MACHINE VALIDATION
  await supabaseAdmin.from('slots').update({
    status: SLOT_STATUS.RESERVED,
    reserved_until: reservedUntil.toISOString(),
  });
}
```

### Payment State Machine

**Status:** ⚠️ **EXISTS BUT NOT ENFORCED**

| Transition              | Enforced? | Location                             | Issue                     |
| ----------------------- | --------- | ------------------------------------ | ------------------------- |
| `initiated → completed` | ❌ No     | `paymentService.verifyUPIPayment()`  | 🔴 No state machine check |
| `initiated → failed`    | ❌ No     | `paymentService.markPaymentFailed()` | 🔴 No state machine check |
| `initiated → expired`   | ❌ No     | `paymentService.expirePayments()`    | 🔴 No state machine check |

**🔴 CRITICAL:** Payment state machine exists but payment service methods don't use it.

### Transaction Safety

**Status:** 🔴 **CRITICAL GAPS**

| Operation            | Atomic?    | Transaction?               | Issue                                             |
| -------------------- | ---------- | -------------------------- | ------------------------------------------------- |
| Booking creation     | ❌ No      | ❌ No                      | 🔴 Slot reservation + booking creation not atomic |
| Booking confirmation | ⚠️ Partial | ✅ Yes (payment flow only) | 🟠 Only atomic in payment confirmation function   |
| Payment verification | ✅ Yes     | ✅ Yes                     | ✅ Uses DB function                               |
| Slot reservation     | ❌ No      | ❌ No                      | 🔴 Race condition possible                        |

**🔴 CRITICAL:** Booking creation flow:

1. Reserve slot (non-atomic)
2. Create booking (separate operation)
3. If booking fails, manually release slot

**Attack Scenario:** Two concurrent requests can both reserve the same slot if they check availability simultaneously.

---

## PART 3: RBAC & AUTHORIZATION AUDIT

### API Endpoint Authorization Matrix

| Endpoint                        | Method | Required Role              | Enforced?              | Risk |
| ------------------------------- | ------ | -------------------------- | ---------------------- | ---- |
| `/api/bookings`                 | POST   | Public (intentional)       | ✅ OK                  | -    |
| `/api/bookings/[id]`            | GET    | Customer/Owner/Admin       | ✅ Yes                 | -    |
| `/api/bookings/[id]/accept`     | POST   | Owner/Admin                | ✅ Yes                 | -    |
| `/api/bookings/[id]/reject`     | POST   | Owner/Admin                | ✅ Yes                 | -    |
| `/api/bookings/[id]/cancel`     | POST   | Customer/Owner             | ✅ Yes                 | -    |
| `/api/bookings/[id]/reschedule` | POST   | Customer/Owner             | ✅ Yes                 | -    |
| `/api/bookings/[id]/no-show`    | POST   | Owner                      | ✅ Yes                 | -    |
| `/api/salons`                   | POST   | Optional (backward compat) | ⚠️ Should require auth | 🟡   |
| `/api/slots`                    | POST   | Owner/Admin                | ✅ Yes                 | -    |
| `/api/slots/[slotId]/reserve`   | POST   | Public (intentional)       | ✅ OK                  | -    |
| `/api/slots/[slotId]/release`   | POST   | Public (intentional)       | ✅ OK                  | -    |
| `/api/payments/initiate`        | POST   | Customer (own booking)     | ✅ Yes                 | -    |
| `/api/payments/verify`          | POST   | Customer/Owner/Admin       | ✅ Yes                 | -    |
| `/api/payments/webhook/upi`     | POST   | Webhook signature          | ✅ Yes                 | -    |
| `/api/admin/*`                  | ALL    | Admin                      | ✅ Yes                 | -    |
| `/api/owner/*`                  | ALL    | Owner                      | ✅ Yes                 | -    |
| `/api/customer/*`               | ALL    | Customer                   | ✅ Yes                 | -    |

### RBAC Implementation Issues

**🟡 MEDIUM:** Inconsistent role checking patterns:

- Some endpoints: `userProfile?.user_type === 'admin'`
- Some endpoints: `checkIsAdminServer(user.id)`
- Some endpoints: `profile?.role === 'admin'` (wrong field name - should be `user_type`)

**Code Evidence:**

```typescript
// app/api/payments/verify/route.ts:56
const isAdmin = userProfile?.role === "admin"; // ❌ WRONG - should be user_type

// app/api/admin/bookings/[id]/route.ts:23
const isAdmin = await checkIsAdminServer(user.id); // ✅ CORRECT
```

**🟠 HIGH:** Role field inconsistency:

- Schema: `user_profiles.user_type` (correct)
- Some code: `userProfile?.role` (wrong)
- Some code: `profile?.user_type` (correct)

---

## PART 4: SECURITY & TRUST BOUNDARIES

### Client Trust Analysis

| Data                     | Trusted? | Server Calculation                                 | Risk    |
| ------------------------ | -------- | -------------------------------------------------- | ------- |
| `total_price_cents`      | ❌ No    | ✅ Yes (`serviceService.calculateTotalPrice()`)    | ✅ Safe |
| `total_duration_minutes` | ❌ No    | ✅ Yes (`serviceService.calculateTotalDuration()`) | ✅ Safe |
| `amount_cents` (payment) | ❌ No    | ✅ Yes (`paymentService.createUPIPayment()`)       | ✅ Safe |
| Booking status           | ❌ No    | ✅ Server-only updates                             | ✅ Safe |
| Slot status              | ❌ No    | ✅ Server-only updates                             | ✅ Safe |

**✅ GOOD:** All money-related calculations are server-side.

### Input Validation

**Status:** ✅ **MOSTLY GOOD**

- ✅ UUID validation: `isValidUUID()`
- ✅ Field filtering: `filterFields()` prevents mass assignment
- ✅ String length validation
- ✅ Zod schemas for booking/salon creation
- ⚠️ Some endpoints lack comprehensive validation

### Output Filtering

**Status:** ⚠️ **PARTIAL**

- ✅ Admin endpoints filter sensitive data
- ⚠️ Some booking responses may leak internal IDs
- ⚠️ Error messages may leak information

### CSRF Protection

**Status:** ✅ **IMPLEMENTED**

- ✅ Nonce-based replay protection
- ✅ `request_nonces` table
- ✅ Used in booking creation and payment initiation

### IDOR (Insecure Direct Object Reference)

**Status:** ✅ **MOSTLY PROTECTED**

- ✅ Booking access: Ownership verified
- ✅ Business access: Ownership verified
- ✅ Payment access: Ownership verified
- ⚠️ Slot access: Public for available slots (intentional, but no ownership check for booked slots in some paths)

---

## PART 5: PAYMENT & MONEY SAFETY

### Payment Flow Security

| Check                          | Status | Implementation                               | Risk    |
| ------------------------------ | ------ | -------------------------------------------- | ------- |
| Amount server-calculated       | ✅ Yes | `paymentService.createUPIPayment()`          | ✅ Safe |
| Webhook signature verification | ✅ Yes | `verifyUPIWebhookSignature()`                | ✅ Safe |
| Idempotent payment handlers    | ✅ Yes | `idempotency_key` unique constraint          | ✅ Safe |
| Payment → booking atomic       | ✅ Yes | `confirm_booking_with_payment()` DB function | ✅ Safe |
| Slot expiry enforced           | ✅ Yes | Checked in payment initiation                | ✅ Safe |
| Duplicate webhook handling     | ✅ Yes | `webhook_payload_hash`                       | ✅ Safe |

**✅ EXCELLENT:** Payment system is well-secured.

**🟠 HIGH ISSUE:** `payment_attempts` table exists but is NEVER used. Payment failures should be logged here for analytics and abuse detection.

**Code Gap:**

```typescript
// services/payment.service.ts:343-369
async markPaymentFailed(...) {
  // ❌ NO INSERT INTO payment_attempts
  // Should track attempt_count and log to payment_attempts
}
```

---

## PART 6: ABUSE & RATE LIMITING

### Rate Limiting Coverage

| Endpoint                      | Rate Limited? | Limit    | Status  |
| ----------------------------- | ------------- | -------- | ------- |
| `/api/bookings`               | ✅ Yes        | Enhanced | ✅ Good |
| `/api/bookings/[id]/accept`   | ✅ Yes        | 10/min   | ✅ Good |
| `/api/bookings/[id]/reject`   | ✅ Yes        | 10/min   | ✅ Good |
| `/api/slots/[slotId]/reserve` | ✅ Yes        | 20/min   | ✅ Good |
| `/api/slots/[slotId]/release` | ✅ Yes        | 20/min   | ✅ Good |
| `/api/payments/initiate`      | ✅ Yes        | 10/min   | ✅ Good |
| `/api/payments/verify`        | ✅ Yes        | 20/min   | ✅ Good |
| `/api/salons`                 | ✅ Yes        | 5/min    | ✅ Good |
| `/api/security/generate-*`    | ✅ Yes        | 50/min   | ✅ Good |

**✅ GOOD:** Most critical endpoints are rate-limited.

### Abuse Prevention

**Status:** ⚠️ **PARTIAL**

- ✅ Rate limiting on critical endpoints
- ✅ Nonce-based replay protection
- ⚠️ No detection of rapid reserve-release loops
- ⚠️ No abuse scoring or flagging
- ⚠️ No CAPTCHA integration
- ⚠️ `payment_attempts` table not used for tracking

---

## PART 7: AUDIT LOGGING & OBSERVABILITY

### Audit Log Coverage

| Mutation            | Logged?           | Service              | Issue                |
| ------------------- | ----------------- | -------------------- | -------------------- |
| Booking created     | ✅ Yes            | `auditService`       | ✅ Good              |
| Booking confirmed   | ⚠️ Partial        | Events only          | 🟡 Not in audit_logs |
| Booking rejected    | ✅ Yes            | `auditService`       | ✅ Good              |
| Booking cancelled   | ✅ Yes            | `auditService`       | ✅ Good              |
| Booking rescheduled | ✅ Yes            | `auditService`       | ✅ Good              |
| Payment initiated   | ✅ Yes            | `payment_audit_logs` | ✅ Good              |
| Payment verified    | ✅ Yes            | `payment_audit_logs` | ✅ Good              |
| Payment failed      | ✅ Yes            | `payment_audit_logs` | ✅ Good              |
| Business created    | ✅ Yes            | `auditService`       | ✅ Good              |
| Business updated    | ⚠️ **NOT LOGGED** | -                    | 🔴 Missing           |
| Slot reserved       | ❌ No             | Events only          | 🟡 Not in audit_logs |
| Slot booked         | ❌ No             | Events only          | 🟡 Not in audit_logs |

**🟠 HIGH:** Business updates not logged in `audit_logs` table.

**🟡 MEDIUM:** Slot state changes only emit events, not audit logs.

---

## PART 8: CONFIGURATION & HARDENING

### Configuration Analysis

| Setting                            | Source                             | Hardcoded? | Status                  |
| ---------------------------------- | ---------------------------------- | ---------- | ----------------------- |
| `SLOT_EXPIRY_MINUTES`              | `env.payment.slotExpiryMinutes`    | ❌ No      | ✅ Config-driven        |
| `PAYMENT_EXPIRY_MINUTES`           | `env.payment.paymentExpiryMinutes` | ❌ No      | ✅ Config-driven        |
| `SLOT_RESERVATION_TIMEOUT_MINUTES` | `config/constants.ts`              | ⚠️ **YES** | 🔴 Should be env-driven |
| `MAX_PAYMENT_ATTEMPTS`             | `env.payment.maxPaymentAttempts`   | ❌ No      | ✅ Config-driven        |
| Booking expiry                     | `BOOKING_EXPIRY_HOURS = 24`        | ⚠️ **YES** | 🟡 Should be env-driven |
| Reminder timing                    | `REMINDER_24H_BEFORE_HOURS = 24`   | ⚠️ **YES** | 🟡 Should be env-driven |

**🔴 CRITICAL:** `SLOT_RESERVATION_TIMEOUT_MINUTES` is hardcoded in `config/constants.ts` but should match `env.payment.slotExpiryMinutes`.

**Code Evidence:**

```typescript
// config/constants.ts:21
export const SLOT_RESERVATION_TIMEOUT_MINUTES = 10; // ❌ HARDCODED

// config/env.ts
slotExpiryMinutes: parseInt(process.env.SLOT_EXPIRY_MINUTES || "10", 10); // ✅ ENV-DRIVEN
```

---

## CRITICAL ISSUES SUMMARY

### 🔴 CRITICAL (Must Fix Immediately)

1. **Booking Creation Not Atomic**
   - **Issue:** Slot reservation and booking creation are separate operations
   - **Risk:** Race condition allows double-booking
   - **Fix:** Use database transaction or stored procedure

2. **Slot State Machine Not Enforced**
   - **Issue:** `slotStateMachine` exists but never used in `slot.service.ts`
   - **Risk:** Invalid state transitions possible
   - **Fix:** Add state machine validation to all slot operations

3. **Payment State Machine Not Enforced**
   - **Issue:** `paymentStateMachine` exists but payment service doesn't use it
   - **Risk:** Invalid payment state transitions
   - **Fix:** Add state machine validation to payment operations

4. **Payment Attempts Table Unused**
   - **Issue:** `payment_attempts` table exists but never inserted
   - **Risk:** Cannot track payment failures for abuse detection
   - **Fix:** Insert into `payment_attempts` on payment failure

5. **Booking Payment Columns Never Set**
   - **Issue:** `payment_required` and `payment_type` columns never written
   - **Risk:** Schema drift, confusion
   - **Fix:** Set these fields when payment is required

6. **Business Suspension Not Enforced**
   - **Issue:** `suspended`, `suspended_at`, `suspended_reason` columns never read
   - **Risk:** Suspended businesses can still operate
   - **Fix:** Add suspension checks to all business queries

7. **Slot Reservation Timeout Mismatch**
   - **Issue:** `SLOT_RESERVATION_TIMEOUT_MINUTES` hardcoded, doesn't match env
   - **Risk:** Inconsistent behavior
   - **Fix:** Use `env.payment.slotExpiryMinutes` everywhere

### 🟠 HIGH RISK

1. **Booking Confirmation Not Atomic (Non-Payment Path)**
   - **Issue:** `confirmBooking()` doesn't atomically update slot
   - **Risk:** Booking confirmed but slot not booked
   - **Fix:** Use transaction or DB function

2. **Role Field Inconsistency**
   - **Issue:** Some code uses `role`, some uses `user_type`
   - **Risk:** RBAC failures
   - **Fix:** Standardize on `user_type`

3. **Business Updates Not Audited**
   - **Issue:** Business updates not logged in `audit_logs`
   - **Risk:** No audit trail for business changes
   - **Fix:** Add audit logging to business update endpoints

### 🟡 MEDIUM RISK

1. **Location Verification Not Enforced**
   - **Issue:** `is_location_verified` column never read
   - **Risk:** Unverified locations shown in search
   - **Fix:** Filter by `is_location_verified = true` in search

2. **Search Radius Not Used**
   - **Issue:** `search_radius_km` column never read
   - **Risk:** Fixed 10km radius instead of per-business
   - **Fix:** Use business-specific radius in location queries

3. **Slot State Changes Not Audited**
   - **Issue:** Slot transitions only emit events, not audit logs
   - **Risk:** Limited audit trail
   - **Fix:** Add audit logging for slot state changes

### 🟢 LOW RISK

1. **Metric Timings Not Queried**
   - **Issue:** `metric_timings` table created but never read
   - **Risk:** Wasted storage
   - **Fix:** Add analytics queries or remove table

2. **Hardcoded Booking Expiry**
   - **Issue:** `BOOKING_EXPIRY_HOURS = 24` hardcoded
   - **Risk:** Cannot adjust without code change
   - **Fix:** Move to env config

---

## DEAD SCHEMA / DEAD CODE

### Dead Schema (Never Used)

1. **`payment_attempts` table**
   - Created but never inserted
   - **Action:** Either implement usage or remove

### Partially Used Schema

1. **`metric_timings` table**
   - Inserted but never queried
   - **Action:** Add analytics queries or remove

2. **`bookings.payment_required`**
   - Column exists, never set
   - **Action:** Set when payment flow initiated

3. **`bookings.payment_type`**
   - Column exists, never set
   - **Action:** Set when payment flow initiated

---

## ATTACK SCENARIOS

### Scenario 1: Double-Booking Race Condition

**Exploit:**

1. Attacker sends 2 concurrent requests to `/api/bookings` with same `slot_id`
2. Both requests pass slot availability check
3. Both reserve the slot (race condition)
4. Both create bookings
5. Result: Double-booking

**Mitigation Status:** ❌ **NOT MITIGATED** - No atomic transaction

**Fix Required:** Use database transaction or stored procedure for booking creation

---

### Scenario 2: Slot Hoarding

**Exploit:**

1. Attacker rapidly reserves multiple slots
2. Lets them expire
3. Repeats to block legitimate users
4. No abuse detection

**Mitigation Status:** ⚠️ **PARTIAL** - Rate limiting exists but no pattern detection

**Fix Required:** Track reserve-expire loops, flag suspicious users

---

### Scenario 3: Invalid State Transitions

**Exploit:**

1. Direct database access (if compromised) or API bug
2. Transition slot from `booked` → `available` (bypasses state machine)
3. Slot becomes available while booking exists

**Mitigation Status:** 🔴 **NOT MITIGATED** - State machine not enforced

**Fix Required:** Enforce state machine in all slot operations

---

### Scenario 4: Suspended Business Still Operating

**Exploit:**

1. Admin suspends business
2. Business owner continues to receive bookings
3. No enforcement of suspension

**Mitigation Status:** 🔴 **NOT MITIGATED** - Suspension columns never read

**Fix Required:** Add `suspended = false` check to all business queries

---

### Scenario 5: Payment Amount Tampering (Prevented ✅)

**Exploit Attempt:**

1. Attacker sends `amount_cents: 1` in payment initiation
2. Server ignores and calculates server-side
3. **Result:** Attack fails ✅

**Mitigation Status:** ✅ **MITIGATED** - Amount always server-calculated

---

## REQUIRED FIXES

### Schema Changes

1. **Remove or implement `payment_attempts` table**

   ```sql
   -- Option 1: Remove if not needed
   DROP TABLE IF EXISTS payment_attempts;

   -- Option 2: Implement usage (recommended)
   -- See code changes below
   ```

2. **Add NOT NULL constraints where appropriate**
   - Review nullable columns that should be NOT NULL

### Code Changes

1. **Make booking creation atomic**

   ```typescript
   // Create stored procedure or use transaction
   // database/migration_atomic_booking_creation.sql
   ```

2. **Enforce slot state machine**

   ```typescript
   // services/slot.service.ts
   async reserveSlot(slotId: string): Promise<boolean> {
     const slot = await this.getSlotById(slotId);
     if (!slotStateMachine.canTransition(slot.status, 'reserve')) {
       return false;
     }
     // ... rest of logic
   }
   ```

3. **Enforce payment state machine**

   ```typescript
   // services/payment.service.ts
   async verifyUPIPayment(...) {
     if (!paymentStateMachine.canTransition(payment.status, 'verify')) {
       throw new Error('Invalid payment state transition');
     }
     // ... rest of logic
   }
   ```

4. **Use payment_attempts table**

   ```typescript
   // services/payment.service.ts
   async markPaymentFailed(...) {
     // ... existing code ...
     await supabaseAdmin.from('payment_attempts').insert({
       payment_id: payment.id,
       attempt_number: (payment.attempt_count || 0) + 1,
       status: 'failed',
       error_message: reason,
     });
   }
   ```

5. **Add business suspension checks**

   ```typescript
   // services/salon.service.ts
   async getSalonById(id: string): Promise<Salon | null> {
     const { data } = await supabaseAdmin
       .from('businesses')
       .select('*')
       .eq('id', id)
       .eq('suspended', false) // ✅ Add this
       .single();
   }
   ```

6. **Fix role field inconsistency**

   ```typescript
   // Replace all instances of:
   userProfile?.role === "admin";
   // With:
   userProfile?.user_type === "admin";
   ```

7. **Set payment_required and payment_type**

   ```typescript
   // app/api/payments/initiate/route.ts
   // After payment creation, update booking:
   await supabaseAdmin
     .from("bookings")
     .update({ payment_required: true, payment_type: "full" })
     .eq("id", booking_id);
   ```

8. **Use env for slot reservation timeout**
   ```typescript
   // config/constants.ts
   // Remove hardcoded value, import from env
   export const SLOT_RESERVATION_TIMEOUT_MINUTES =
     env.payment.slotExpiryMinutes;
   ```

---

## SECURITY SCORE BREAKDOWN

| Category                  | Score | Notes                                |
| ------------------------- | ----- | ------------------------------------ |
| Schema Consistency        | 6/10  | Dead schema, unused columns          |
| State Machine Enforcement | 4/10  | Machines exist but not enforced      |
| Transaction Safety        | 6/10  | Payment flow good, booking flow weak |
| RBAC                      | 8/10  | Mostly good, some inconsistencies    |
| Payment Security          | 9/10  | Excellent implementation             |
| Rate Limiting             | 8/10  | Good coverage                        |
| Audit Logging             | 7/10  | Most mutations logged, some gaps     |
| Configuration             | 7/10  | Mostly env-driven, some hardcoded    |

**Overall: 7/10** ⚠️

---

## PRIORITY ACTION ITEMS

### Immediate (This Week)

1. 🔴 Make booking creation atomic
2. 🔴 Enforce slot state machine
3. 🔴 Enforce payment state machine
4. 🔴 Add business suspension checks
5. 🔴 Fix role field inconsistency

### High Priority (This Month)

1. 🟠 Implement payment_attempts tracking
2. 🟠 Add business update audit logging
3. 🟠 Set payment_required/payment_type fields
4. 🟠 Use env for all timeouts

### Medium Priority (Next Sprint)

1. 🟡 Add location verification filtering
2. 🟡 Use search_radius_km in queries
3. 🟡 Add slot state change audit logs
4. 🟡 Remove or implement metric_timings queries

---

## CONCLUSION

The codebase has **strong payment security** and **good RBAC coverage**, but suffers from **critical transaction safety gaps** and **state machine enforcement failures**. The schema is mostly utilized but has some dead/unused components.

**Key Strengths:**

- ✅ Payment system is production-grade
- ✅ Most endpoints properly secured
- ✅ Good rate limiting coverage
- ✅ Server-side calculations for money

**Key Weaknesses:**

- 🔴 Non-atomic booking creation
- 🔴 State machines not enforced
- 🔴 Business suspension not enforced
- 🔴 Some schema drift (unused columns)

**Recommendation:** Address critical issues before production launch. High-priority items should be fixed within 1 month.
