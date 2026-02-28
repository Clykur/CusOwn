# Supabase-Native Caching Strategy

## Overview

All caching uses ONLY Supabase + PostgreSQL + Next.js capabilities. No external cache (Redis/Upstash) is used.

---

## 1. PostgreSQL-Level Optimizations

### Indexes (Applied)

- `idx_businesses_booking_link_optimized` - Covering index for business lookups
- `idx_bookings_booking_id_optimized` - Covering index for booking status
- `idx_businesses_owner_user_id` - Owner businesses lookup
- `idx_bookings_customer_user_id` - Customer bookings lookup
- `idx_bookings_active` - Partial index for active bookings
- `idx_slots_business_date_status_optimized` - Optimized slot queries

### Query Optimizations

- Specific SELECT columns (no SELECT \*)
- Deterministic WHERE clauses
- Proper ORDER BY with indexed columns
- Partial indexes for filtered queries

---

## 2. Next.js Server-Side Caching

### React `cache()` Function

Used for:

- `salonService.getSalonById()` - Cached per request
- `salonService.getSalonByBookingLink()` - Cached per request
- `bookingService.getBookingById()` - Cached per request

**TTL**: Per-request (automatic deduplication)

---

## 3. HTTP Cache Headers

### Public GET Endpoints (Cache-Control)

**Business Profile** (`/api/salons/[bookingLink]`)

- `s-maxage=300` (5 minutes)
- `stale-while-revalidate=600` (10 minutes)
- **Reason**: Public data, changes infrequently

**Booking Status** (`/api/bookings/booking-id/[bookingId]`)

- Pending/Confirmed: `s-maxage=30` (30 seconds)
- Final states: `s-maxage=300` (5 minutes)
- **Reason**: Active bookings need freshness, completed ones are static

**QR Code** (`/api/salons/[bookingLink]/qr`)

- `s-maxage=86400` (24 hours)
- `stale-while-revalidate=172800` (48 hours)
- **Reason**: QR codes never change once generated

**Business List** (`/api/salons/list`)

- `s-maxage=300` (5 minutes)
- `stale-while-revalidate=600` (10 minutes)
- **Reason**: Discovery page, moderate update frequency

**Locations** (`/api/salons/locations`)

- `s-maxage=1800` (30 minutes)
- `stale-while-revalidate=3600` (1 hour)
- **Reason**: Location list changes rarely

**Owner Businesses** (`/api/owner/businesses`)

- `s-maxage=60` (1 minute)
- `stale-while-revalidate=120` (2 minutes)
- **Reason**: Authenticated, but changes infrequently

**Customer Bookings** (`/api/customer/bookings`)

- `s-maxage=30` (30 seconds)
- `stale-while-revalidate=60` (1 minute)
- **Reason**: User's own data, needs freshness

### No-Cache Endpoints

**Slot Availability** (`/api/slots`)

- `no-store, no-cache, must-revalidate`
- **Reason**: CRITICAL - Must always be live (reservations, bookings)

**Booking Mutations** (`/api/bookings` POST, `/api/bookings/[id]/*`)

- `no-store, no-cache, must-revalidate`
- **Reason**: Write operations, must not be cached

**Owner Bookings** (`/api/bookings/salon/[salonId]`)

- `no-store, no-cache, must-revalidate`
- **Reason**: Real-time management data

---

## 4. Client-Side Caching

### Cache Keys

- Business: `business:{id}` or `business:link:{bookingLink}`
- Booking: `booking:{bookingId}`
- Booking List: `bookings:customer:{userId}` or `bookings:salon:{salonId}`

### Cache Ages (Client-Side)

- Business: 5 minutes
- Booking Status: 30 seconds (active), 5 minutes (final)
- Booking List: 1 minute
- Locations: 30 minutes

### Refetch Strategy

- On window focus
- After mutations (POST/PUT/DELETE)
- On route navigation
- Manual refresh button

---

## 5. What is NOT Cached

### ❌ NEVER Cached

1. **Slot Availability** - Must be real-time (reservations, bookings)
2. **Booking Creation** - Write operations
3. **Booking Mutations** - Accept, reject, cancel
4. **Slot Reservations** - Time-sensitive state
5. **Owner Dashboard Bookings** - Real-time management

### ✅ Safe to Cache

1. **Business Profile** - Public, changes infrequently
2. **Booking Status (Final)** - Cancelled/rejected bookings
3. **QR Codes** - Never change once generated
4. **Location List** - Changes rarely
5. **Business List** - Discovery, moderate freshness OK

---

## 6. Cache Invalidation

### Automatic

- Next.js `cache()` - Per-request deduplication (automatic)
- HTTP headers - Browser/CDN respects TTL
- Client-side - Refetch on focus/mutation

### Manual (Not Required)

- No manual invalidation needed
- Cache expires naturally via TTL
- Fresh data on next request

---

## 7. Performance Impact

### Expected Improvements

- **Business Lookups**: 5-10x faster (indexes + HTTP cache)
- **Booking Status**: 3-5x faster (indexes + HTTP cache)
- **Public Pages**: 10x faster (CDN caching)
- **Slot Queries**: Optimized (indexes only, no cache)

### Slot Integrity

- ✅ Slots always fetched live
- ✅ No stale reservation data
- ✅ No race conditions
- ✅ Real-time availability

---

## 8. Database Metrics

Metrics stored in PostgreSQL:

- `metrics` table - Counter metrics
- `metric_timings` table - Performance timings
- Auto-cleanup (keeps last 1000 per metric)

---

## 9. Rate Limiting

In-memory rate limiting:

- Per-IP tracking
- 60-second windows
- Auto-cleanup of expired entries
- No external dependencies

---

## Verification Checklist

- ✅ No Redis/Upstash dependencies
- ✅ Slot availability NOT cached
- ✅ Booking mutations NOT cached
- ✅ Public endpoints have cache headers
- ✅ Authenticated endpoints have shorter TTLs
- ✅ PostgreSQL indexes optimized
- ✅ Queries use specific SELECT columns
- ✅ Client-side caching hints provided
- ✅ Works within Supabase free tier
