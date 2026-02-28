# CusOwn Security Audit & Marketplace Implementation Plan

**Date:** 2026-01-25  
**Auditor:** Senior Backend + Security Engineer  
**Status:** 🔴 CRITICAL SECURITY GAPS IDENTIFIED

---

## EXECUTIVE SUMMARY

### Current Security Posture: **MODERATE RISK**

**Strengths:**

- ✅ Soft slot locking with `reserved_until`
- ✅ State machines for booking/slot transitions
- ✅ Rate limiting (in-memory)
- ✅ Input filtering and validation
- ✅ HMAC token generation
- ✅ CSRF protection
- ✅ Audit logging for mutations

**Critical Gaps:**

- ❌ **NO DATABASE TRANSACTIONS** - Race conditions possible
- ❌ **NO PESSIMISTIC LOCKING** - Double booking risk
- ❌ **IN-MEMORY RATE LIMITING** - Lost on restart, no distributed protection
- ❌ **NO PAYMENT SECURITY** - Payment integration missing
- ❌ **NO REPLAY PROTECTION** - Request IDs/nonces missing
- ❌ **NO WEBHOOK VERIFICATION** - Future payment webhooks vulnerable
- ❌ **CLIENT-SIDE CALCULATIONS** - Duration/price can be manipulated
- ❌ **NO GEO-SEARCH RATE LIMITS** - Enumeration/scraping possible

---

## PHASE 1: MARKETPLACE FEATURES (SECURE IMPLEMENTATION)

### 1.1 Location-Based Discovery

#### Database Schema Changes

```sql
-- Add location fields to businesses table
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS city TEXT,
  ADD COLUMN IF NOT EXISTS area TEXT,
  ADD COLUMN IF NOT EXISTS pincode TEXT,
  ADD COLUMN IF NOT EXISTS latitude DECIMAL(10, 8),
  ADD COLUMN IF NOT EXISTS longitude DECIMAL(11, 8),
  ADD COLUMN IF NOT EXISTS search_radius_km INTEGER DEFAULT 10,
  ADD COLUMN IF NOT EXISTS is_location_verified BOOLEAN DEFAULT FALSE;

-- Indexes for geo-search
CREATE INDEX IF NOT EXISTS idx_businesses_location
  ON businesses USING GIST (
    ll_to_earth(latitude, longitude)
  ) WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_city_area
  ON businesses(city, area) WHERE city IS NOT NULL AND area IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_pincode
  ON businesses(pincode) WHERE pincode IS NOT NULL;

-- Prevent location enumeration via sequential IDs
-- Use UUIDs (already implemented) + rate limiting
```

#### API Contract: `/api/businesses/search`

**Request:**

```typescript
POST /api/businesses/search
Headers:
  Authorization: Bearer <token> (optional for public search)
  X-Request-ID: <uuid> (required for replay protection)
  X-CSRF-Token: <token> (if authenticated)

Body:
{
  // Location (at least one required)
  latitude?: number;      // -90 to 90
  longitude?: number;     // -180 to 180
  city?: string;         // Max 100 chars
  area?: string;         // Max 100 chars
  pincode?: string;      // Max 10 chars, alphanumeric

  // Filters
  category?: string;     // Allowlist: ['salon', 'clinic', 'gym', ...]
  radius_km?: number;    // 1-50, default 10
  available_today?: boolean;
  min_rating?: number;   // 0-5, optional

  // Pagination
  page?: number;         // 1-based, max 100
  limit?: number;        // 1-50, default 20

  // Sorting
  sort_by?: 'distance' | 'rating' | 'availability' | 'price';
  sort_order?: 'asc' | 'desc';
}
```

**Response:**

```typescript
{
  success: boolean;
  data?: {
    businesses: Array<{
      id: string;                    // UUID (public)
      salon_name: string;
      location: string;              // Area only (not full address)
      distance_km?: number;          // If lat/lng provided
      next_available_slot?: string;  // ISO datetime
      rating?: number;                // 0-5
      category: string;
      // NO internal IDs, NO owner info, NO full address
    }>;
    pagination: {
      page: number;
      limit: number;
      total: number;                  // Approximate (rate-limited)
      has_more: boolean;
    };
  };
  error?: string;
}
```

#### Server-Side Validation Rules

```pseudocode
FUNCTION validateGeoSearchRequest(request):
  // 1. Rate limiting (per IP + per user)
  rateLimitKey = "geo_search:" + (user_id || ip_address)
  IF rateLimitStore.get(rateLimitKey) > MAX_SEARCHES_PER_MINUTE:
    RETURN error(429, "Too many searches")

  // 2. Input validation
  IF request.latitude:
    IF request.latitude < -90 OR request.latitude > 90:
      RETURN error(400, "Invalid latitude")
    IF request.longitude < -180 OR request.longitude > 180:
      RETURN error(400, "Invalid longitude")

  // 3. Prevent enumeration
  IF request.page > 100:
    RETURN error(400, "Page limit exceeded")

  IF request.limit > 50:
    RETURN error(400, "Limit exceeded")

  // 4. Replay protection
  requestId = request.headers["X-Request-ID"]
  IF NOT isValidUUID(requestId):
    RETURN error(400, "Invalid request ID")

  IF nonceStore.exists(requestId):
    RETURN error(409, "Duplicate request")

  nonceStore.set(requestId, TTL=5_MINUTES)

  // 5. Location validation
  IF NOT (request.latitude AND request.longitude) AND
     NOT (request.city OR request.area OR request.pincode):
    RETURN error(400, "Location required")

  RETURN validated_request
END FUNCTION
```

#### Geo-Search Implementation (Haversine)

```pseudocode
FUNCTION searchBusinessesByLocation(validatedRequest):
  // Use database transaction for consistency
  BEGIN TRANSACTION ISOLATION LEVEL READ COMMITTED;

  TRY:
    // Base query
    query = "SELECT id, salon_name, location, latitude, longitude, category"
    query += " FROM businesses"
    query += " WHERE is_active = true"

    // Category filter (allowlist)
    IF validatedRequest.category:
      IF validatedRequest.category NOT IN ALLOWED_CATEGORIES:
        RETURN error(400, "Invalid category")
      query += " AND category = $1"
      params.append(validatedRequest.category)

    // Location filter
    IF validatedRequest.latitude AND validatedRequest.longitude:
      // Haversine formula in SQL (PostGIS extension)
      query += " AND ll_to_earth(latitude, longitude) <@>"
      query += " ll_to_earth($lat, $lng) < $radius_km"
      params.append(validatedRequest.latitude)
      params.append(validatedRequest.longitude)
      params.append(validatedRequest.radius_km || 10)
    ELSE IF validatedRequest.pincode:
      query += " AND pincode = $pincode"
      params.append(validatedRequest.pincode)
    ELSE IF validatedRequest.city:
      query += " AND city = $city"
      params.append(validatedRequest.city)
      IF validatedRequest.area:
        query += " AND area = $area"
        params.append(validatedRequest.area)

    // Availability filter (server-side only)
    IF validatedRequest.available_today:
      today = CURRENT_DATE
      query += " AND EXISTS ("
      query += "   SELECT 1 FROM slots"
      query += "   WHERE slots.business_id = businesses.id"
      query += "   AND slots.date = $today"
      query += "   AND slots.status = 'available'"
      query += "   AND slots.start_time >= CURRENT_TIME"
      query += " )"
      params.append(today)

    // Pagination
    offset = (validatedRequest.page - 1) * validatedRequest.limit
    query += " LIMIT $limit OFFSET $offset"
    params.append(validatedRequest.limit)
    params.append(offset)

    // Execute query
    results = db.execute(query, params)

    // Calculate distances (if lat/lng provided)
    IF validatedRequest.latitude:
      FOR EACH business IN results:
        business.distance_km = haversine(
          validatedRequest.latitude,
          validatedRequest.longitude,
          business.latitude,
          business.longitude
        )

    // Sort (server-side for accuracy)
    IF validatedRequest.sort_by == 'distance':
      results.sort_by(distance_km)
    ELSE IF validatedRequest.sort_by == 'rating':
      results.sort_by(rating DESC)

    // Sanitize output (remove sensitive data)
    FOR EACH business IN results:
      business.remove('latitude', 'longitude', 'owner_user_id', 'whatsapp_number')
      business.location = business.area  // Only show area, not full address

    COMMIT TRANSACTION;
    RETURN results

  CATCH error:
    ROLLBACK TRANSACTION;
    LOG error WITH context;
    RETURN error(500, "Search failed")
  END TRY
END FUNCTION
```

#### Security Risks & Mitigations

| Risk                     | Mitigation                                                |
| ------------------------ | --------------------------------------------------------- |
| **Location Enumeration** | Rate limit: 20 searches/min per IP, 50/min per user       |
| **Scraping**             | Pagination limit (max 100 pages), approximate total count |
| **Coordinate Injection** | Strict validation: lat [-90, 90], lng [-180, 180]         |
| **SQL Injection**        | Parameterized queries, input sanitization                 |
| **Replay Attacks**       | Request ID nonce store (5-min TTL)                        |
| **Data Leakage**         | Output filtering: no internal IDs, no owner info          |

#### Failure Scenarios

1. **Invalid coordinates** → 400 Bad Request
2. **Rate limit exceeded** → 429 Too Many Requests
3. **No results** → Empty array (not an error)
4. **Database timeout** → 503 Service Unavailable
5. **Duplicate request ID** → 409 Conflict

---

### 1.2 Multi-Service Booking

#### Database Schema Changes

```sql
-- Services table
CREATE TABLE IF NOT EXISTS services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL CHECK (duration_minutes > 0),
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0),
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(business_id, name)
);

-- Booking services junction table
CREATE TABLE IF NOT EXISTS booking_services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  price_cents INTEGER NOT NULL CHECK (price_cents >= 0), -- Snapshot at booking time
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(booking_id, service_id)
);

-- Add total fields to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS total_duration_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS total_price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS services_count INTEGER DEFAULT 1;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_services_business ON services(business_id);
CREATE INDEX IF NOT EXISTS idx_booking_services_booking ON booking_services(booking_id);
CREATE INDEX IF NOT EXISTS idx_booking_services_service ON booking_services(service_id);

-- Constraint: Prevent overlapping services (if business has such rules)
-- This is business-specific, implement via application logic
```

#### API Contract: `/api/bookings` (Extended)

**Request:**

```typescript
POST /api/bookings
Headers:
  Authorization: Bearer <token> (optional)
  X-Request-ID: <uuid> (required)
  X-CSRF-Token: <token>

Body:
{
  business_id: string;        // UUID
  slot_id: string;            // UUID (start slot)
  customer_name: string;      // 2-100 chars
  customer_phone: string;     // Valid phone format
  service_ids: string[];      // Array of service UUIDs (1-10 services)
  // NO duration, NO price in request (calculated server-side)
}
```

**Response:**

```typescript
{
  success: boolean;
  data?: {
    booking: {
      id: string;
      booking_id: string;
      status: 'pending';
      total_duration_minutes: number;  // Server-calculated
      total_price_cents: number;       // Server-calculated
      services: Array<{
        id: string;
        name: string;
        duration_minutes: number;
        price_cents: number;
      }>;
      slot: {
        id: string;
        date: string;
        start_time: string;
        end_time: string;              // Extended based on duration
      };
    };
    whatsapp_url?: string;
  };
  error?: string;
}
```

#### Server-Side Validation & Calculation

```pseudocode
FUNCTION createMultiServiceBooking(request):
  // 1. Rate limiting
  rateLimitKey = "booking:" + (user_id || ip_address)
  IF rateLimitStore.get(rateLimitKey) > MAX_BOOKINGS_PER_HOUR:
    RETURN error(429, "Too many bookings")

  // 2. Input validation
  IF request.service_ids.length == 0:
    RETURN error(400, "At least one service required")

  IF request.service_ids.length > MAX_SERVICES_PER_BOOKING:
    RETURN error(400, "Too many services")

  // 3. Replay protection
  requestId = request.headers["X-Request-ID"]
  IF nonceStore.exists(requestId):
    RETURN error(409, "Duplicate request")
  nonceStore.set(requestId, TTL=10_MINUTES)

  // 4. BEGIN TRANSACTION (CRITICAL)
  BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

  TRY:
    // 5. Validate business exists and is active
    business = db.select("businesses")
                 .where("id = $1 AND is_active = true")
                 .for_update()  // Pessimistic lock
                 .execute(request.business_id)

    IF NOT business:
      ROLLBACK;
      RETURN error(404, "Business not found")

    // 6. Validate and fetch services (server-side only)
    serviceIds = request.service_ids
    services = db.select("services")
                 .where("id = ANY($1) AND business_id = $2 AND is_active = true")
                 .for_update()
                 .execute(serviceIds, request.business_id)

    IF services.length != serviceIds.length:
      ROLLBACK;
      RETURN error(400, "Invalid or inactive service")

    // 7. Calculate total duration (SERVER-SIDE ONLY)
    totalDurationMinutes = 0
    totalPriceCents = 0

    FOR EACH service IN services:
      totalDurationMinutes += service.duration_minutes
      totalPriceCents += service.price_cents

    // 8. Validate slot exists and is available
    slot = db.select("slots")
             .where("id = $1 AND business_id = $2")
             .for_update()
             .execute(request.slot_id, request.business_id)

    IF NOT slot:
      ROLLBACK;
      RETURN error(404, "Slot not found")

    IF slot.status != 'available' AND slot.status != 'reserved':
      ROLLBACK;
      RETURN error(409, "Slot not available")

    // 9. Check if slot has enough time for all services
    slotDurationMinutes = calculateMinutes(slot.start_time, slot.end_time)

    IF totalDurationMinutes > slotDurationMinutes:
      // Need to extend slot or find consecutive slots
      extendedEndTime = addMinutes(slot.start_time, totalDurationMinutes)

      // Check if extended time conflicts with next slot
      nextSlot = db.select("slots")
                   .where("business_id = $1 AND date = $2 AND start_time = $3")
                   .execute(request.business_id, slot.date, slot.end_time)

      IF nextSlot AND nextSlot.status != 'available':
        ROLLBACK;
        RETURN error(409, "Insufficient time for selected services")

      // Reserve extended slot range atomically
      IF nextSlot:
        IF nextSlot.status != 'available':
          ROLLBACK;
          RETURN error(409, "Consecutive slot not available")

        // Lock next slot
        db.update("slots")
          .set("status = 'reserved'")
          .set("reserved_until = $1")
          .where("id = $2 AND status = 'available'")
          .execute(calculateReservationExpiry(), nextSlot.id)

        IF rows_affected == 0:
          ROLLBACK;
          RETURN error(409, "Slot reservation failed")

    // 10. Reserve primary slot (atomic)
    reservationExpiry = calculateReservationExpiry()  // 5 minutes from now
    rowsAffected = db.update("slots")
                     .set("status = 'reserved'")
                     .set("reserved_until = $1")
                     .where("id = $2 AND status IN ('available', 'reserved')")
                     .where("(reserved_until IS NULL OR reserved_until < NOW())")
                     .execute(reservationExpiry, request.slot_id)

    IF rowsAffected == 0:
      ROLLBACK;
      RETURN error(409, "Slot reservation failed - race condition")

    // 11. Create booking (atomic)
    bookingId = generateUniqueId()
    booking = db.insert("bookings")
                 .values({
                   business_id: request.business_id,
                   slot_id: request.slot_id,
                   customer_name: sanitize(request.customer_name),
                   customer_phone: formatPhone(request.customer_phone),
                   booking_id: bookingId,
                   status: 'pending',
                   total_duration_minutes: totalDurationMinutes,
                   total_price_cents: totalPriceCents,
                   services_count: services.length
                 })
                 .returning("*")
                 .execute()

    // 12. Link services to booking (atomic)
    FOR EACH service IN services:
      db.insert("booking_services")
        .values({
          booking_id: booking.id,
          service_id: service.id,
          price_cents: service.price_cents  // Snapshot price
        })
        .execute()

    // 13. Mark slot as booked
    db.update("slots")
      .set("status = 'booked'")
      .set("reserved_until = NULL")
      .where("id = $1")
      .execute(request.slot_id)

    // 14. If extended slot was reserved, mark it too
    IF nextSlot:
      db.update("slots")
        .set("status = 'booked'")
        .set("reserved_until = NULL")
        .where("id = $1")
        .execute(nextSlot.id)

    COMMIT TRANSACTION;

    // 15. Emit events (outside transaction)
    emitBookingCreated(booking, services)

    RETURN booking

  CATCH error:
    ROLLBACK TRANSACTION;
    LOG error WITH full_context;

    // Release any partial reservations
    IF slot_reserved:
      releaseSlot(request.slot_id)
    IF nextSlot_reserved:
      releaseSlot(nextSlot.id)

    RETURN error(500, "Booking creation failed")
  END TRY
END FUNCTION
```

#### Security Risks & Mitigations

| Risk                                  | Mitigation                                                             |
| ------------------------------------- | ---------------------------------------------------------------------- |
| **Client-side duration manipulation** | All calculations server-side, never trust client                       |
| **Service price tampering**           | Snapshot prices in `booking_services`, validate against current prices |
| **Overlapping service selection**     | Validate services belong to same business, check for conflicts         |
| **Race condition on slot extension**  | SERIALIZABLE transaction + pessimistic locking                         |
| **Partial booking creation**          | Atomic transaction, rollback on any failure                            |

#### Failure Scenarios

1. **Service not found** → 404, rollback
2. **Insufficient slot time** → 409 Conflict, suggest alternative slots
3. **Consecutive slot unavailable** → 409 Conflict
4. **Transaction deadlock** → 503, retry with exponential backoff
5. **Price changed** → 409 Conflict, return updated prices

---

### 1.3 Payment Integration (Razorpay/Stripe)

#### Database Schema Changes

```sql
-- Payment providers enum
CREATE TYPE payment_provider AS ENUM ('razorpay', 'stripe', 'cash');

-- Payment status enum
CREATE TYPE payment_status AS ENUM (
  'pending',
  'processing',
  'completed',
  'failed',
  'refunded',
  'partially_refunded'
);

-- Payments table
CREATE TABLE IF NOT EXISTS payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE RESTRICT,
  provider payment_provider NOT NULL,
  provider_payment_id TEXT NOT NULL,  -- External payment ID
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'INR',
  status payment_status NOT NULL DEFAULT 'pending',
  payment_method TEXT,  -- 'card', 'upi', 'netbanking', etc.
  payment_intent_id TEXT,  -- For Stripe
  order_id TEXT,  -- For Razorpay

  -- Webhook tracking
  webhook_received_at TIMESTAMP WITH TIME ZONE,
  webhook_signature TEXT,  -- Store for verification
  webhook_payload_hash TEXT,  -- SHA256 of webhook body

  -- Refund tracking
  refund_amount_cents INTEGER DEFAULT 0,
  refund_reason TEXT,
  refunded_at TIMESTAMP WITH TIME ZONE,
  refunded_by UUID REFERENCES users(id),

  -- Security
  idempotency_key TEXT UNIQUE,  -- Prevent duplicate payments
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment attempts (for retry tracking)
CREATE TABLE IF NOT EXISTS payment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  attempt_number INTEGER NOT NULL,
  status payment_status NOT NULL,
  error_message TEXT,
  provider_response TEXT,  -- JSON response from provider
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_payments_provider_id ON payments(provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_idempotency ON payments(idempotency_key);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- Add payment fields to bookings
ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS payment_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS payment_type TEXT CHECK (payment_type IN ('full', 'deposit', 'cash')),
  ADD COLUMN IF NOT EXISTS deposit_percentage INTEGER CHECK (deposit_percentage >= 0 AND deposit_percentage <= 100);

-- Constraint: Booking can only be confirmed after payment (if required)
-- Enforced via application logic + database trigger
```

#### API Contract: `/api/payments/create`

**Request:**

```typescript
POST /api/payments/create
Headers:
  Authorization: Bearer <token> (required)
  X-Request-ID: <uuid> (required)
  X-CSRF-Token: <token> (required)
  X-Idempotency-Key: <uuid> (required)

Body:
{
  booking_id: string;        // UUID
  amount_cents: number;       // Server-validated, not trusted
  payment_type: 'full' | 'deposit' | 'cash';
  provider: 'razorpay' | 'stripe';
  // NO payment method details here (handled by provider SDK)
}
```

**Response:**

```typescript
{
  success: boolean;
  data?: {
    payment: {
      id: string;
      status: 'processing';
      amount_cents: number;
      provider: string;
    };
    payment_intent: {
      // Provider-specific payment intent (client_token, order_id, etc.)
      // Used by client to complete payment
    };
  };
  error?: string;
}
```

#### Payment Flow Implementation

```pseudocode
FUNCTION createPayment(request):
  // 1. Authentication & Authorization
  user = getAuthenticatedUser(request)
  IF NOT user:
    RETURN error(401, "Unauthorized")

  // 2. Rate limiting (stricter for payments)
  rateLimitKey = "payment:" + user.id
  IF rateLimitStore.get(rateLimitKey) > MAX_PAYMENTS_PER_HOUR:
    RETURN error(429, "Too many payment attempts")

  // 3. Idempotency check (CRITICAL)
  idempotencyKey = request.headers["X-Idempotency-Key"]
  IF NOT isValidUUID(idempotencyKey):
    RETURN error(400, "Invalid idempotency key")

  existingPayment = db.select("payments")
                      .where("idempotency_key = $1")
                      .execute(idempotencyKey)

  IF existingPayment:
    // Return existing payment (idempotent)
    RETURN existingPayment

  // 4. Validate booking
  booking = db.select("bookings")
              .where("id = $1")
              .for_update()  // Pessimistic lock
              .execute(request.booking_id)

  IF NOT booking:
    RETURN error(404, "Booking not found")

  // 5. Verify booking ownership (if customer)
  IF user.role == 'customer':
    IF booking.customer_user_id != user.id:
      RETURN error(403, "Access denied")

  // 6. Verify booking status
  IF booking.status != 'pending':
    RETURN error(409, "Booking cannot be paid")

  // 7. Check if payment already exists
  existingPaymentForBooking = db.select("payments")
                                 .where("booking_id = $1 AND status = 'completed'")
                                 .execute(request.booking_id)

  IF existingPaymentForBooking:
    RETURN error(409, "Payment already completed")

  // 8. Calculate amount (SERVER-SIDE ONLY, never trust client)
  calculatedAmount = calculatePaymentAmount(booking, request.payment_type)

  IF request.amount_cents != calculatedAmount:
    LOG security_alert: "Amount mismatch", user.id, booking.id
    RETURN error(400, "Invalid amount")

  // 9. BEGIN TRANSACTION
  BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

  TRY:
    // 10. Create payment record
    payment = db.insert("payments")
                .values({
                  booking_id: request.booking_id,
                  provider: request.provider,
                  amount_cents: calculatedAmount,
                  status: 'pending',
                  idempotency_key: idempotencyKey,
                  payment_type: request.payment_type
                })
                .returning("*")
                .execute()

    // 11. Create payment intent with provider
    IF request.provider == 'razorpay':
      razorpayOrder = razorpayClient.orders.create({
        amount: calculatedAmount,
        currency: 'INR',
        receipt: booking.booking_id,
        notes: {
          booking_id: booking.id,
          payment_id: payment.id
        }
      })

      providerPaymentId = razorpayOrder.id
      paymentIntent = {
        order_id: razorpayOrder.id,
        key_id: RAZORPAY_KEY_ID
      }

    ELSE IF request.provider == 'stripe':
      stripePaymentIntent = stripeClient.paymentIntents.create({
        amount: calculatedAmount,
        currency: 'inr',
        metadata: {
          booking_id: booking.id,
          payment_id: payment.id
        }
      })

      providerPaymentId = stripePaymentIntent.id
      paymentIntent = {
        client_secret: stripePaymentIntent.client_secret
      }

    // 12. Update payment with provider ID
    db.update("payments")
      .set("provider_payment_id = $1")
      .set("status = 'processing'")
      .where("id = $2")
      .execute(providerPaymentId, payment.id)

    COMMIT TRANSACTION;

    // 13. Return payment intent (client uses this to complete payment)
    RETURN {
      payment: payment,
      payment_intent: paymentIntent
    }

  CATCH error:
    ROLLBACK TRANSACTION;
    LOG error WITH context;
    RETURN error(500, "Payment creation failed")
  END TRY
END FUNCTION
```

#### Webhook Verification & Processing

```pseudocode
FUNCTION handlePaymentWebhook(request, provider):
  // 1. Verify webhook signature (CRITICAL)
  signature = request.headers["X-Razorpay-Signature"]  // or Stripe-Signature
  webhookSecret = getWebhookSecret(provider)

  IF NOT verifyWebhookSignature(request.body, signature, webhookSecret):
    LOG security_alert: "Invalid webhook signature", provider, request.ip
    RETURN error(401, "Invalid signature")

  // 2. Parse webhook payload
  payload = JSON.parse(request.body)
  providerPaymentId = payload.id  // or payload.payment_intent.id for Stripe

  // 3. Idempotency check (prevent duplicate processing)
  payloadHash = SHA256(request.body)
  existingWebhook = db.select("payments")
                      .where("webhook_payload_hash = $1")
                      .execute(payloadHash)

  IF existingWebhook:
    // Already processed, return success (idempotent)
    RETURN { success: true, message: "Already processed" }

  // 4. Find payment
  payment = db.select("payments")
              .where("provider = $1 AND provider_payment_id = $2")
              .for_update()
              .execute(provider, providerPaymentId)

  IF NOT payment:
    LOG warning: "Webhook for unknown payment", providerPaymentId
    RETURN error(404, "Payment not found")

  // 5. BEGIN TRANSACTION
  BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

  TRY:
    // 6. Verify payment status from provider
    IF provider == 'razorpay':
      razorpayPayment = razorpayClient.payments.fetch(providerPaymentId)
      paymentStatus = mapRazorpayStatus(razorpayPayment.status)
      amountVerified = razorpayPayment.amount == payment.amount_cents
    ELSE IF provider == 'stripe':
      stripePayment = stripeClient.paymentIntents.retrieve(providerPaymentId)
      paymentStatus = mapStripeStatus(stripePayment.status)
      amountVerified = stripePayment.amount == payment.amount_cents

    // 7. Verify amount (prevent tampering)
    IF NOT amountVerified:
      LOG security_alert: "Amount mismatch in webhook", payment.id, providerPaymentId
      ROLLBACK;
      RETURN error(400, "Amount verification failed")

    // 8. Update payment status
    oldStatus = payment.status
    db.update("payments")
      .set("status = $1")
      .set("webhook_received_at = NOW()")
      .set("webhook_signature = $2")
      .set("webhook_payload_hash = $3")
      .where("id = $4")
      .execute(paymentStatus, signature, payloadHash, payment.id)

    // 9. If payment completed, confirm booking
    IF paymentStatus == 'completed' AND oldStatus != 'completed':
      booking = db.select("bookings")
                  .where("id = $1")
                  .for_update()
                  .execute(payment.booking_id)

      IF booking.status == 'pending':
        // Confirm booking atomically
        db.update("bookings")
          .set("status = 'confirmed'")
          .where("id = $1 AND status = 'pending'")
          .execute(booking.id)

        // Mark slot as booked (if not already)
        db.update("slots")
          .set("status = 'booked'")
          .where("id = $1")
          .execute(booking.slot_id)

        // Emit events
        emitBookingConfirmed(booking)
        emitPaymentCompleted(payment)

    // 10. If payment failed, release slot
    ELSE IF paymentStatus == 'failed':
      booking = db.select("bookings")
                  .where("id = $1")
                  .for_update()
                  .execute(payment.booking_id)

      IF booking.status == 'pending':
        // Release slot
        db.update("slots")
          .set("status = 'available'")
          .set("reserved_until = NULL")
          .where("id = $1")
          .execute(booking.slot_id)

        // Optionally cancel booking
        db.update("bookings")
          .set("status = 'cancelled'")
          .set("cancelled_by = 'system'")
          .set("cancellation_reason = 'Payment failed'")
          .where("id = $1")
          .execute(booking.id)

    COMMIT TRANSACTION;

    // 11. Log payment attempt
    db.insert("payment_attempts")
      .values({
        payment_id: payment.id,
        attempt_number: 1,
        status: paymentStatus,
        provider_response: JSON.stringify(payload)
      })
      .execute()

    RETURN { success: true }

  CATCH error:
    ROLLBACK TRANSACTION;
    LOG error WITH full_context;
    RETURN error(500, "Webhook processing failed")
  END TRY
END FUNCTION

FUNCTION verifyWebhookSignature(body, signature, secret):
  // Razorpay: HMAC SHA256
  IF provider == 'razorpay':
    expectedSignature = HMAC_SHA256(body, secret)
    RETURN timingSafeEqual(signature, expectedSignature)

  // Stripe: HMAC SHA256 with timestamp
  ELSE IF provider == 'stripe':
    timestamp = request.headers["Stripe-Signature-Timestamp"]
    signedPayload = timestamp + "." + body
    expectedSignature = HMAC_SHA256(signedPayload, secret)
    RETURN timingSafeEqual(signature, expectedSignature)

  RETURN false
END FUNCTION
```

#### Security Risks & Mitigations

| Risk                    | Mitigation                                                |
| ----------------------- | --------------------------------------------------------- |
| **Webhook spoofing**    | HMAC signature verification with timing-safe comparison   |
| **Replay attacks**      | Idempotency keys + webhook payload hash deduplication     |
| **Amount tampering**    | Server-side calculation, verify against provider response |
| **Payment ID reuse**    | Unique constraint on `idempotency_key`                    |
| **Double confirmation** | Atomic transaction + status check before confirmation     |
| **Race conditions**     | SERIALIZABLE transaction + pessimistic locking            |

---

## PHASE 2: SECURITY HARDENING

### 2.1 Database Transaction Implementation

**Current State:** ❌ NO TRANSACTIONS - Critical vulnerability

**Required Changes:**

```pseudocode
// Wrap all critical operations in transactions
FUNCTION reserveSlotAtomically(slotId):
  BEGIN TRANSACTION ISOLATION LEVEL SERIALIZABLE;

  TRY:
    slot = db.select("slots")
             .where("id = $1")
             .for_update()  // Pessimistic lock
             .execute(slotId)

    IF slot.status != 'available':
      ROLLBACK;
      RETURN false

    db.update("slots")
      .set("status = 'reserved'")
      .set("reserved_until = $1")
      .where("id = $2 AND status = 'available'")
      .execute(calculateExpiry(), slotId)

    COMMIT;
    RETURN true

  CATCH:
    ROLLBACK;
    RETURN false
  END TRY
END FUNCTION
```

### 2.2 Distributed Rate Limiting (Redis)

**Current State:** ❌ In-memory (lost on restart)

**Required Implementation:**

```pseudocode
// Use Redis for distributed rate limiting
FUNCTION distributedRateLimit(key, maxRequests, windowMs):
  redisKey = "rate_limit:" + key
  current = redis.incr(redisKey)

  IF current == 1:
    redis.expire(redisKey, windowMs / 1000)

  IF current > maxRequests:
    RETURN false

  RETURN true
END FUNCTION
```

### 2.3 Replay Protection

**Implementation:**

```sql
-- Request nonces table
CREATE TABLE IF NOT EXISTS request_nonces (
  nonce TEXT PRIMARY KEY,
  user_id UUID,
  ip_address INET,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nonces_expires ON request_nonces(expires_at);

-- Cleanup job (run every 5 minutes)
DELETE FROM request_nonces WHERE expires_at < NOW();
```

### 2.4 RBAC Enforcement

```pseudocode
FUNCTION enforceRBAC(request, requiredRole, resourceOwnerId?):
  user = getAuthenticatedUser(request)

  IF NOT user:
    RETURN error(401, "Unauthorized")

  // Admin bypass
  IF user.role == 'admin':
    RETURN true

  // Role check
  IF user.role != requiredRole:
    RETURN error(403, "Insufficient permissions")

  // Ownership check (if resource-specific)
  IF resourceOwnerId:
    IF user.id != resourceOwnerId:
      RETURN error(403, "Access denied")

  RETURN true
END FUNCTION
```

### 2.5 Output Filtering

```pseudocode
FUNCTION sanitizeBusinessOutput(business, userRole):
  sanitized = {
    id: business.id,  // Public UUID only
    salon_name: business.salon_name,
    location: business.area,  // Not full address
    category: business.category
  }

  // Only include sensitive data for owners/admins
  IF userRole == 'owner' OR userRole == 'admin':
    sanitized.whatsapp_number = business.whatsapp_number
    sanitized.address = business.address

  // Never expose:
  // - owner_user_id
  // - internal IDs
  // - latitude/longitude (unless user is owner)

  RETURN sanitized
END FUNCTION
```

---

## PHASE 3: IMPLEMENTATION CHECKLIST

### Critical (Week 1-2)

- [ ] Add database transactions to all booking/slot operations
- [ ] Implement pessimistic locking for slot reservation
- [ ] Add request ID nonce store for replay protection
- [ ] Migrate rate limiting to Redis
- [ ] Add RBAC middleware to all API routes

### High Priority (Week 3-4)

- [ ] Location-based discovery API
- [ ] Multi-service booking schema + API
- [ ] Payment integration (Razorpay first)
- [ ] Webhook verification
- [ ] Output filtering middleware

### Medium Priority (Week 5-6)

- [ ] Payment refund handling
- [ ] Auto-accept feature
- [ ] Enhanced audit logging
- [ ] Security monitoring alerts

---

## SECURITY TESTING CHECKLIST

- [ ] Test race conditions (concurrent slot reservations)
- [ ] Test payment webhook replay attacks
- [ ] Test amount tampering attempts
- [ ] Test enumeration attacks (location, booking IDs)
- [ ] Test privilege escalation attempts
- [ ] Load test with adversarial traffic
- [ ] Penetration testing

---

**END OF DOCUMENT**
