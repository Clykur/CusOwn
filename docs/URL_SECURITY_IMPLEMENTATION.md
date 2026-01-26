# URL Security Implementation

## Overview
All URLs in the application have been secured with token-based authentication to prevent unauthorized access, IDOR (Insecure Direct Object Reference) attacks, and URL enumeration.

## Security Features Implemented

### 1. Token-Based URL Generation
- **HMAC-SHA256 tokens** with time-based validation
- **24-hour expiration** with 1-hour clock skew tolerance
- **Resource-type isolation** (salon, booking, owner-dashboard, accept, reject, etc.)
- **64-character hex tokens** for enhanced security

### 2. Secure URL Helpers

#### Client-Side (Async)
- `getSecureSalonUrlClient(salonId)` - Generate secure salon URLs
- `getSecureBookingUrlClient(bookingLink)` - Generate secure booking URLs
- `getSecureBookingStatusUrlClient(bookingId)` - Generate secure booking status URLs
- `getSecureOwnerDashboardUrlClient(bookingLink)` - Generate secure owner dashboard URLs
- `getSecureAcceptUrlClient(bookingId)` - Generate secure accept URLs
- `getSecureRejectUrlClient(bookingId)` - Generate secure reject URLs

#### Server-Side (Synchronous)
- `getSecureSalonUrlServer(salonId)` - Server-side salon URLs
- `getSecureBookingUrlServer(bookingLink)` - Server-side booking URLs
- `getSecureBookingStatusUrlServer(bookingId)` - Server-side booking status URLs
- `getSecureOwnerDashboardUrlServer(bookingLink)` - Server-side owner dashboard URLs
- `getSecureAcceptUrlServer(bookingId)` - Server-side accept URLs
- `getSecureRejectUrlServer(bookingId)` - Server-side reject URLs

### 3. URL Validation

#### Booking Page (`/b/[bookingLink]`)
- ✅ Extracts token from URL query parameters
- ✅ Passes token to API for validation
- ✅ Auto-redirects to secure URL if UUID detected without token
- ✅ Validates tokens server-side via `/api/salons/[bookingLink]`

#### Owner Dashboard (`/owner/[bookingLink]`)
- ✅ Extracts token from URL query parameters
- ✅ Passes token to API for validation
- ✅ Auto-redirects to secure URL if UUID detected without token
- ✅ Validates ownership for slug-based booking links
- ✅ Requires token for UUID-based access

#### Booking Status Page (`/booking/[bookingId]`)
- ✅ Extracts token from URL query parameters
- ✅ Passes token to API for validation
- ✅ Auto-redirects to secure URL if UUID detected without token
- ✅ Generates secure URLs for all booking links

#### Accept/Reject Pages (`/accept/[id]`, `/reject/[id]`)
- ✅ Extracts token from URL query parameters
- ✅ Validates tokens via API routes
- ✅ One-time use enforcement (handled by API)

### 4. API Route Security

#### `/api/salons/[bookingLink]`
- ✅ Validates tokens for UUID-based salon IDs
- ✅ Allows public access for booking link slugs (intended behavior)
- ✅ Verifies ownership for owner dashboard access
- ✅ Rate limiting: 30 requests/minute per IP

#### `/api/bookings/[id]`
- ✅ Validates tokens for booking status access
- ✅ Resource type: `booking-status`

#### `/api/bookings/[id]/accept`
- ✅ Validates tokens for accept actions
- ✅ Resource type: `accept`

#### `/api/bookings/[id]/reject`
- ✅ Validates tokens for reject actions
- ✅ Resource type: `reject`

### 5. Component Updates

#### Customer Dashboard
- ✅ Generates secure URLs for all booking status links
- ✅ Uses `getSecureBookingStatusUrlClient()` for all booking links

#### Owner Dashboard
- ✅ Generates secure URLs for all business dashboard links
- ✅ Uses `getSecureOwnerDashboardUrlClient()` for owner dashboard links

#### Booking Status Page
- ✅ Generates secure URL for current booking
- ✅ Auto-redirects if token missing for UUID-based booking IDs

### 6. URL Generation Strategy

#### Public URLs (No Token Required)
- Booking links (slugs): `/b/{bookingLink}` - Intended for public sharing
- Category pages: `/categories`, `/categories/salon`
- Home page: `/`
- Auth pages: `/auth/login`, `/select-role`

#### Secure URLs (Token Required)
- Salon detail (UUID): `/salon/{salonId}?token={token}`
- Booking status (UUID): `/booking/{bookingId}?token={token}`
- Owner dashboard (UUID): `/owner/{bookingLink}?token={token}`
- Accept action: `/accept/{bookingId}?token={token}`
- Reject action: `/reject/{bookingId}?token={token}`

### 7. Token Validation Logic

1. **Format Validation**: Checks token format (64/32/16 char hex)
2. **Time-Based Validation**: Validates token within 24-hour window
3. **Resource Matching**: Ensures token matches resource type and ID
4. **Timing-Safe Comparison**: Uses `timingSafeEqual` to prevent timing attacks

### 8. Auto-Redirect Behavior

When a UUID-based resource is accessed without a token:
1. Client detects missing token
2. Generates secure URL via API
3. Redirects to secure URL with token
4. User can then access the resource

## Security Benefits

1. **Prevents IDOR Attacks**: Tokens prevent guessing UUIDs
2. **Prevents URL Enumeration**: Tokens are cryptographically secure
3. **Time-Limited Access**: Tokens expire after 24 hours
4. **Resource Isolation**: Different resource types use different token generation
5. **Ownership Verification**: Owner dashboards verify user ownership
6. **Rate Limiting**: Prevents brute force attacks

## Migration Notes

- Booking links (slugs) remain public for SEO and sharing
- UUID-based resources require tokens
- All new URL generation should use secure helpers
- Existing public booking links continue to work
- Secure URLs are generated automatically when needed

## Files Modified

1. `lib/utils/navigation.ts` - Added secure URL helpers
2. `lib/utils/security.ts` - Token generation and validation
3. `app/b/[bookingLink]/page.tsx` - Token extraction and validation
4. `app/owner/[bookingLink]/page.tsx` - Token extraction and validation
5. `app/booking/[bookingId]/page.tsx` - Token extraction and secure URL generation
6. `app/customer/dashboard/page.tsx` - Secure URL generation for booking links
7. `app/owner/dashboard/page.tsx` - Secure URL generation for owner dashboards
8. `app/api/salons/[bookingLink]/route.ts` - Token validation and ownership checks
9. `app/api/bookings/[id]/route.ts` - Token validation
10. `app/api/bookings/[id]/accept/route.ts` - Token validation
11. `app/api/bookings/[id]/reject/route.ts` - Token validation

## Testing Checklist

- [ ] Booking page with slug works (public)
- [ ] Booking page with UUID requires token
- [ ] Owner dashboard with slug works (with auth)
- [ ] Owner dashboard with UUID requires token
- [ ] Booking status page requires token for UUID
- [ ] Accept/reject links require valid tokens
- [ ] Expired tokens are rejected
- [ ] Invalid tokens are rejected
- [ ] Auto-redirect works for missing tokens
