# UPI Payment System - Production Implementation

## Overview

Secure, production-grade UPI payment system for CusOwn slot-booking platform with zero-trust client model, atomic transactions, and comprehensive security measures.

---

## Database Schema

### Payments Table Extensions

```sql
-- UPI-specific fields added to payments table
payment_id TEXT UNIQUE                    -- Unique payment identifier (PAY{timestamp}{random})
upi_payment_link TEXT                     -- UPI payment deep link
upi_qr_code TEXT                          -- Base64 QR code image
expires_at TIMESTAMP WITH TIME ZONE       -- Payment expiration time
transaction_id TEXT                       -- UPI transaction reference
verified_at TIMESTAMP WITH TIME ZONE      -- Verification timestamp
verified_by UUID                          -- User who verified (for manual)
verification_method TEXT                  -- 'webhook' | 'manual' | 'polling'
upi_app_used TEXT                         -- UPI app name (PhonePe, GPay, etc.)
failure_reason TEXT                       -- Failure reason
attempt_count INTEGER                     -- Payment attempt counter
```

### Payment Audit Logs

```sql
CREATE TABLE payment_audit_logs (
  id UUID PRIMARY KEY,
  payment_id UUID REFERENCES payments(id),
  actor_id UUID REFERENCES users(id),
  actor_type TEXT,                        -- 'customer' | 'owner' | 'admin' | 'system'
  action TEXT,                            -- Action performed
  from_status payment_status,
  to_status payment_status,
  reason TEXT,
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE
);
```

---

## Payment State Machine

### States

- `initiated` - Payment created, awaiting completion
- `pending` - Legacy state (backward compatibility)
- `processing` - Payment being processed
- `completed` - Payment verified and successful
- `failed` - Payment failed
- `expired` - Payment expired without completion
- `refunded` - Payment refunded
- `partially_refunded` - Partial refund

### Valid Transitions

```
initiated → completed (verify)
initiated → failed (fail)
initiated → expired (expire)
pending → completed (verify)
pending → failed (fail)
processing → completed (verify)
processing → failed (fail)
completed → refunded (refund)
completed → partially_refunded (refund)
```

---

## Payment Flow

### Step 1: Slot Reservation (Pre-payment)

**Prerequisites:**
- Slot must be available or expired-reserved
- Booking must be in `pending` status
- Slot reservation must not be expired

**Process:**
1. Check slot status and `reserved_until` timestamp
2. Validate slot expiry: `now < (booking.created_at + SLOT_EXPIRY_MINUTES)`
3. Reject if slot is `booked` or reservation expired

**API:** Slot reservation handled by existing `/api/slots/[slotId]/reserve`

---

### Step 2: Payment Intent Creation

**Endpoint:** `POST /api/payments/initiate`

**Request:**
```json
{
  "booking_id": "uuid",
  "nonce": "replay-protection-nonce"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "payment_id": "PAY1234567890ABC",
    "upi_payment_link": "upi://pay?pa=merchant@upi&...",
    "upi_qr_code": "data:image/png;base64,...",
    "expires_at": "2026-01-26T12:00:00Z",
    "transaction_id": "TXN1234567890ABC"
  }
}
```

**Security:**
- RBAC: Customer can only initiate for their own bookings
- Nonce validation (replay protection)
- Rate limiting: 10 requests/minute per IP
- Idempotency: Same `booking_id + nonce` returns existing payment if valid

**Server-Side Actions:**
1. Validate booking exists and is `pending`
2. Validate slot is still available/reserved
3. Calculate amount server-side (NEVER trust client)
4. Generate unique `payment_id` and `transaction_id`
5. Create UPI payment link with merchant VPA
6. Generate QR code
7. Set `expires_at = now + PAYMENT_EXPIRY_MINUTES`
8. Insert payment record with `status = 'initiated'`

---

### Step 3: Client Redirection / UPI Collect

**Client Receives:**
- `payment_id` - For status polling
- `upi_payment_link` - Deep link to open UPI app
- `upi_qr_code` - QR code image for scanning
- `expires_at` - Payment expiration time

**Client Actions:**
1. Display QR code or payment link
2. User scans/clicks → Opens UPI app
3. User completes payment in UPI app
4. Poll `/api/payments/[paymentId]/status` for updates

**Client CANNOT:**
- Modify amount
- Modify booking
- Signal payment success directly
- Bypass server verification

---

### Step 4: Payment Verification

#### Option A: Webhook Verification (Automatic)

**Endpoint:** `POST /api/payments/webhook/upi`

**Headers:**
```
x-upi-signature: HMAC-SHA256 signature
```

**Request Body:**
```json
{
  "transaction_id": "TXN1234567890ABC",
  "amount": 1000.00,
  "status": "success",
  "upi_app": "PhonePe",
  "payment_reference": "REF123456"
}
```

**Verification Process:**
1. Verify HMAC signature using `UPI_WEBHOOK_SECRET`
2. Parse and validate payload structure
3. Find payment by `transaction_id`
4. Cross-check: `amount`, `payment_id`, `booking_id`
5. Check payment expiration (reject if expired and `AUTO_REFUND_ON_LATE_SUCCESS = false`)
6. Update payment status to `completed`
7. Verify slot is still available
8. Atomically:
   - Confirm booking (`pending` → `confirmed`)
   - Mark slot as `booked`
9. Log audit entry
10. Store webhook payload hash (idempotency)

**Idempotency:**
- Duplicate webhooks with same payload hash are ignored
- Payment already `completed` → return success without action

#### Option B: Manual Verification

**Endpoint:** `POST /api/payments/verify`

**Request:**
```json
{
  "payment_id": "PAY1234567890ABC",
  "transaction_id": "TXN1234567890ABC"
}
```

**Authorization:**
- Customer (for their own bookings)
- Owner/Admin (for any booking)

**Process:**
1. Validate payment exists and is `initiated`
2. Verify `transaction_id` matches
3. Update payment to `completed`
4. Confirm booking and mark slot as `booked` (atomic)
5. Log audit entry

---

### Step 5: Booking Confirmation (Atomic)

**Transaction Requirements:**
1. Verify slot is still `available` or `reserved`
2. Verify payment status is `completed`
3. Verify booking status is `pending`
4. Atomically:
   - Update booking: `pending` → `confirmed`
   - Update slot: `reserved` → `booked`
5. If any step fails → rollback and mark payment as failed

**Failure Handling:**
- Slot already booked → Mark payment failed, return error
- Booking not pending → Return error (payment may be orphaned)
- Database error → Rollback transaction, mark payment failed

---

### Step 6: Failure Handling

#### Payment Expiration

**Cron Job:** `POST /api/cron/expire-payments`

**Process:**
1. Find payments with `status = 'initiated'` and `expires_at < now`
2. Mark as `expired`
3. Release associated slot if booking is `pending`
4. Log audit entry

**Frequency:** Run every 1-2 minutes

#### Payment Failure

**Scenarios:**
- Webhook reports `status = 'failed'`
- Manual verification failure
- Payment expiration
- Slot unavailable during confirmation

**Actions:**
1. Mark payment as `failed`
2. Increment `attempt_count`
3. Store `failure_reason`
4. Release slot if reserved
5. Cancel booking if `pending` (optional, configurable)

**Retry Logic:**
- Max attempts: `MAX_PAYMENT_ATTEMPTS` (default: 3)
- After max attempts, booking may be cancelled

---

## API Contracts

### POST /api/payments/initiate

**Purpose:** Create UPI payment intent for a booking

**Authentication:** Required (JWT)

**Rate Limit:** 10 req/min per IP

**Request:**
```typescript
{
  booking_id: string;  // UUID
  nonce: string;       // Replay protection nonce
}
```

**Response (Success):**
```typescript
{
  success: true,
  data: {
    payment_id: string;
    upi_payment_link: string;
    upi_qr_code: string;  // Base64 data URL
    expires_at: string;   // ISO 8601
    transaction_id: string;
  }
}
```

**Response (Error):**
```typescript
{
  success: false,
  error: string;
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request (missing fields, invalid booking)
- `401` - Unauthorized
- `403` - Forbidden (not booking owner)
- `409` - Slot not available / expired
- `429` - Rate limited
- `500` - Server error

---

### POST /api/payments/verify

**Purpose:** Manually verify a UPI payment

**Authentication:** Required (Customer/Owner/Admin)

**Rate Limit:** 20 req/min per IP

**Request:**
```typescript
{
  payment_id: string;
  transaction_id: string;
}
```

**Response (Success):**
```typescript
{
  success: true,
  data: {
    payment: Payment;
    booking_id: string;
    message: string;
  }
}
```

**Status Codes:**
- `200` - Success
- `400` - Invalid request / Payment not in valid state
- `401` - Unauthorized
- `403` - Forbidden
- `404` - Payment not found
- `409` - Slot no longer available
- `500` - Server error

---

### POST /api/payments/webhook/upi

**Purpose:** Receive UPI payment webhook from aggregator

**Authentication:** HMAC signature verification

**Rate Limit:** None (webhook endpoint)

**Headers:**
```
x-upi-signature: string;  // HMAC-SHA256
```

**Request Body:**
```typescript
{
  transaction_id: string;
  amount: number;        // In rupees (will be converted to cents)
  status: 'success' | 'failed';
  upi_app?: string;
  payment_reference?: string;
}
```

**Response:**
```typescript
{
  success: true,
  data: {
    success: boolean;
    payment_id?: string;
    message?: string;
  }
}
```

**Status Codes:**
- `200` - Success (processed or already processed)
- `400` - Invalid payload / Payment expired
- `401` - Invalid signature
- `404` - Payment not found
- `409` - Slot no longer available
- `500` - Server error

---

### GET /api/payments/[paymentId]/status

**Purpose:** Get payment status (for polling)

**Authentication:** Required (Customer/Owner/Admin)

**Rate Limit:** 30 req/min per IP

**Response:**
```typescript
{
  success: true,
  data: {
    payment_id: string;
    status: PaymentStatus;
    amount_cents: number;
    currency: string;
    expires_at: string | null;
    transaction_id: string;
    verified_at: string | null;
    upi_app_used: string | null;
    attempt_count: number;
    booking_id: string;
    booking_status: BookingStatus;
  }
}
```

---

## Configuration (Environment Variables)

```bash
# Slot & Payment Expiry
SLOT_EXPIRY_MINUTES=10              # Max 10 minutes (configurable)
PAYMENT_EXPIRY_MINUTES=10           # Payment link expiry

# Payment Limits
MAX_PAYMENT_ATTEMPTS=3              # Max retry attempts

# Late Payment Handling
AUTO_REFUND_ON_LATE_SUCCESS=false  # Reject late webhooks if false

# UPI Merchant Details
UPI_MERCHANT_VPA=merchant@upi       # Merchant UPI VPA
UPI_MERCHANT_NAME=CusOwn            # Merchant display name

# Webhook Security
UPI_WEBHOOK_SECRET=your-secret-key  # HMAC secret for webhook verification
```

---

## Security Measures

### 1. API Security

- **RBAC:** Every endpoint enforces role-based access
- **Rate Limiting:** Per-IP rate limits on all public endpoints
- **CSRF Protection:** Nonce-based replay protection
- **Input Validation:** Strict allowlist validation (UUIDs, amounts server-calculated)

### 2. Payment Security

- **No Client Trust:** Amount calculated server-side only
- **Webhook Verification:** HMAC signature required
- **Idempotency:** Duplicate webhooks ignored safely
- **State Machine:** Strict payment state transitions
- **Audit Logs:** Immutable logs for all state changes

### 3. Slot & Race Condition Safety

- **Atomic Operations:** Database transactions for booking confirmation
- **Expiry Checks:** Slot expiry validated at multiple points:
  - Before payment initiation
  - During webhook processing
  - Before booking confirmation
- **Pessimistic Locking:** Slot status checked and updated atomically

### 4. Abuse Prevention

- **Rate Limiting:** Prevents rapid payment initiation spam
- **Attempt Tracking:** `attempt_count` prevents infinite retries
- **Expiration:** Automatic cleanup of expired payments
- **Audit Trail:** Suspicious patterns detectable via audit logs

---

## Edge Cases & Mitigations

| Edge Case | Mitigation |
|-----------|------------|
| Webhook arrives after payment expired | Check `expires_at`, reject if `AUTO_REFUND_ON_LATE_SUCCESS = false` |
| Slot booked between payment and confirmation | Check slot status atomically, mark payment failed |
| Duplicate webhook with same payload | Store payload hash, ignore duplicates |
| Payment success but booking confirmation fails | Rollback payment status, release slot |
| Client claims payment success without verification | Server never trusts client, requires webhook/manual verification |
| Race condition: two payments for same booking | Idempotency key prevents duplicate payment creation |
| Slot reservation expires during payment | Validate slot expiry before payment initiation and confirmation |
| Network failure during atomic confirmation | Database transaction ensures all-or-nothing |
| Webhook signature verification fails | Reject webhook, log security event |
| Payment amount mismatch | Reject webhook, log security event |

---

## Security Risks & Defenses

| Risk | Defense |
|------|---------|
| **Payment amount tampering** | Amount calculated server-side, never accepted from client |
| **Replay attacks** | Nonce validation, idempotency keys, payload hash deduplication |
| **Webhook spoofing** | HMAC signature verification required |
| **Slot hoarding** | Slot expiry enforced, automatic release on payment failure |
| **Double booking** | Atomic slot booking, pessimistic locking |
| **Payment without slot** | Slot validation at payment initiation and confirmation |
| **Orphaned payments** | Cron job expires payments, releases slots |
| **Race conditions** | Database transactions, atomic updates |
| **Client-side fraud** | Zero-trust model, all verification server-side |
| **Webhook replay** | Payload hash storage, duplicate detection |

---

## Transaction-Safe Pseudocode

### Payment Confirmation (Atomic)

```
BEGIN TRANSACTION;

  -- 1. Verify payment
  payment = SELECT * FROM payments WHERE id = payment_id FOR UPDATE;
  IF payment.status != 'completed':
    ROLLBACK;
    RETURN error('Payment not completed');

  -- 2. Verify booking
  booking = SELECT * FROM bookings WHERE id = payment.booking_id FOR UPDATE;
  IF booking.status != 'pending':
    ROLLBACK;
    RETURN error('Booking not pending');

  -- 3. Verify slot
  slot = SELECT * FROM slots WHERE id = booking.slot_id FOR UPDATE;
  IF slot.status == 'booked':
    ROLLBACK;
    UPDATE payments SET status = 'failed' WHERE id = payment_id;
    RETURN error('Slot already booked');

  -- 4. Atomic updates
  UPDATE bookings SET status = 'confirmed' WHERE id = booking.id;
  UPDATE slots SET status = 'booked' WHERE id = slot.id;
  INSERT INTO payment_audit_logs (...) VALUES (...);

COMMIT;

-- If any step fails, transaction rolls back automatically
```

---

## Monitoring & Alerts

### Key Metrics

- Payment success rate
- Payment expiration rate
- Average payment completion time
- Webhook processing latency
- Failed payment reasons distribution
- Slot-payment desync incidents

### Alerts

- Payment amount mismatch detected
- Slot-payment desync (payment completed but slot not booked)
- Repeated webhook signature failures
- High payment expiration rate
- Payment confirmation failures

---

## Testing Checklist

- [ ] Payment initiation with valid booking
- [ ] Payment initiation with expired slot
- [ ] Payment initiation with already-booked slot
- [ ] Duplicate payment initiation (idempotency)
- [ ] Webhook verification with valid signature
- [ ] Webhook verification with invalid signature
- [ ] Webhook verification with duplicate payload
- [ ] Manual payment verification (customer)
- [ ] Manual payment verification (admin)
- [ ] Payment expiration cron job
- [ ] Payment failure handling
- [ ] Atomic booking confirmation
- [ ] Race condition: concurrent payment confirmations
- [ ] Late webhook after payment expiry
- [ ] Payment amount mismatch detection

---

## Deployment Notes

1. **Run Migration:** Execute `migration_add_upi_payments.sql`
2. **Set Environment Variables:** Configure all payment-related env vars
3. **Configure Cron:** Set up `/api/cron/expire-payments` to run every 1-2 minutes
4. **Webhook URL:** Configure UPI aggregator to send webhooks to `/api/payments/webhook/upi`
5. **Monitor:** Set up alerts for payment metrics and security events

---

## Future Enhancements (Out of Scope for MVP)

- Automatic payment polling (if webhook unavailable)
- Partial payment support
- Payment refund automation
- Multi-currency support
- Payment analytics dashboard
- Fraud detection ML models
