# Security Audit & Hardening Report
**Date:** 2026-01-25  
**System:** CusOwn - Multi-tenant Slot Booking Platform  
**Auditor:** Senior Security Engineer

---

## EXECUTIVE SUMMARY

**Security Confidence Score: 4/10** ⚠️

**Critical Risks Identified:**
1. 🔴 **CRITICAL**: Accept/Reject action links are publicly accessible without tokens
2. 🔴 **CRITICAL**: Booking UUIDs exposed in URLs without authorization
3. 🔴 **CRITICAL**: Slot reservation/release endpoints lack authorization
4. 🟡 **HIGH**: Owner dashboard accessible via guessable bookingLink
5. 🟡 **HIGH**: Booking status pages accessible via guessable bookingId
6. 🟡 **HIGH**: Multiple routes rely on client-side checks only

**Status:** Security hardening required before production deployment.

---

## TASK 1: ROUTE CLASSIFICATION

### Public Routes (Anonymous, Read-Only)
| Route | Method | Access | Data Exposed | Risk Level |
|-------|--------|--------|--------------|------------|
| `/b/[bookingLink]` | GET | Public | Business info, slots | 🟢 LOW |
| `/api/salons/[bookingLink]` | GET | Public* | Business details | 🟡 MEDIUM* |
| `/api/salons/list` | GET | Public | Business list | 🟢 LOW |
| `/api/salons/locations` | GET | Public | Location list | 🟢 LOW |
| `/api/slots` | GET | Public | Slot availability | 🟡 MEDIUM |
| `/categories` | GET | Public | Category list | 🟢 LOW |
| `/categories/salon` | GET | Public | Salon listings | 🟢 LOW |

*Note: `/api/salons/[bookingLink]` now requires token if bookingLink is UUID

### Customer-Authenticated Routes
| Route | Method | Access | Authorization | Risk Level |
|-------|--------|--------|---------------|------------|
| `/customer/dashboard` | GET | Customer | ✅ RLS enforced | 🟢 LOW |
| `/booking/[bookingId]` | GET | Customer* | ⚠️ NO AUTH CHECK | 🔴 CRITICAL |
| `/api/customer/bookings` | GET | Customer | ✅ RLS enforced | 🟢 LOW |
| `/api/bookings/booking-id/[bookingId]` | GET | Public* | ⚠️ NO AUTH CHECK | 🔴 CRITICAL |
| `/api/bookings/[id]` | GET | Public* | ⚠️ NO AUTH CHECK | 🔴 CRITICAL |
| `/api/bookings/[id]/cancel` | POST | Customer | ✅ Auth check | 🟡 MEDIUM |
| `/api/bookings/[id]/reschedule` | POST | Customer/Owner | ✅ Auth check | 🟡 MEDIUM |

*Note: These routes should be customer-authenticated but currently allow public access

### Owner-Authenticated Routes
| Route | Method | Access | Authorization | Risk Level |
|-------|--------|--------|---------------|------------|
| `/owner/dashboard` | GET | Owner | ✅ Auth check | 🟢 LOW |
| `/owner/[bookingLink]` | GET | Owner* | ⚠️ WEAK (bookingLink only) | 🔴 CRITICAL |
| `/api/owner/businesses` | GET | Owner | ✅ Auth check | 🟢 LOW |
| `/api/owner/analytics` | GET | Owner | ✅ Auth check | 🟢 LOW |
| `/api/bookings/salon/[salonId]` | GET | Owner* | ⚠️ NO AUTH CHECK | 🔴 CRITICAL |
| `/api/bookings/[id]/accept` | POST | Owner* | ⚠️ NO AUTH CHECK | 🔴 CRITICAL |
| `/api/bookings/[id]/reject` | POST | Owner* | ⚠️ NO AUTH CHECK | 🔴 CRITICAL |
| `/api/bookings/[id]/no-show` | POST | Owner | ✅ Auth check | 🟡 MEDIUM |
| `/api/slots/[slotId]/reserve` | POST | Public* | ⚠️ NO AUTH CHECK | 🔴 CRITICAL |
| `/api/slots/[slotId]/release` | POST | Public* | ⚠️ NO AUTH CHECK | 🔴 CRITICAL |

*Note: These routes should require owner authentication but currently don't

### Admin-Authenticated Routes
| Route | Method | Access | Authorization | Risk Level |
|-------|--------|--------|---------------|------------|
| `/admin/dashboard` | GET | Admin | ✅ Auth check | 🟢 LOW |
| `/admin/businesses/[id]` | GET/PUT/DELETE | Admin | ✅ Auth check | 🟢 LOW |
| `/admin/bookings/[id]` | GET/PUT | Admin | ✅ Auth check | 🟢 LOW |
| `/api/admin/*` | ALL | Admin | ✅ Auth check | 🟢 LOW |

### Action Links (CRITICAL)
| Route | Method | Access | Authorization | Risk Level |
|-------|--------|--------|---------------|------------|
| `/accept/[id]` | GET | Public | ⚠️ NO AUTH CHECK | 🔴 CRITICAL |
| `/reject/[id]` | GET | Public | ⚠️ NO AUTH CHECK | 🔴 CRITICAL |

**CRITICAL ISSUE**: These action links can be:
- Guessed by iterating UUIDs
- Shared and reused indefinitely
- Executed by unauthorized users
- Used to mutate bookings without validation

---

## TASK 2: IDOR & URL ABUSE PREVENTION

### Exploitable Vectors Identified

#### 1. Booking UUID Exposure
**Route:** `/api/bookings/[id]` (UUID)  
**Issue:** Anyone can access any booking by guessing UUID  
**Impact:** Customer data exposure, booking manipulation  
**Fix Required:** Add authorization check + tokenization

#### 2. Booking ID Exposure
**Route:** `/api/bookings/booking-id/[bookingId]`  
**Issue:** Short booking IDs (e.g., "UA0KQ91") are guessable  
**Impact:** Customer data exposure  
**Fix Required:** Add authorization check + tokenization

#### 3. Owner Dashboard via BookingLink
**Route:** `/owner/[bookingLink]`  
**Issue:** BookingLink slugs can be guessed or enumerated  
**Impact:** Unauthorized access to owner dashboard  
**Fix Required:** Add tokenization + ownership verification

#### 4. Slot Reservation Abuse
**Route:** `/api/slots/[slotId]/reserve`  
**Issue:** No authorization - anyone can reserve any slot  
**Impact:** Slot hijacking, denial of service  
**Fix Required:** Add authorization + rate limiting

#### 5. Accept/Reject Link Abuse
**Route:** `/accept/[id]`, `/reject/[id]`  
**Issue:** Public action links without tokens or expiration  
**Impact:** Booking manipulation, unauthorized actions  
**Fix Required:** Tokenization + one-time use + expiration

---

## TASK 3: ACTION LINKS HARDENING

### Current State
- Accept/Reject links are public GET routes
- No tokenization
- No expiration
- No one-time use enforcement
- No authorization checks

### Required Hardening
1. Generate secure tokens for action links
2. Add expiration (24 hours)
3. Enforce one-time use (mark as used after execution)
4. Verify ownership at execution time
5. Add rate limiting

---

## TASK 4: RLS HARDENING STATUS

### Current RLS Policies

#### businesses table
- ✅ Owners can view own businesses
- ✅ Admins can view all businesses
- ⚠️ Public access allowed where owner_user_id IS NULL (backward compatibility risk)

#### bookings table
- ✅ Customers can view own bookings (via customer_user_id)
- ✅ Owners can view bookings for their businesses
- ✅ Admins can view all bookings
- ⚠️ Public access allowed where customer_user_id IS NULL (backward compatibility risk)

#### slots table
- ⚠️ **NO RLS POLICIES FOUND** - This is CRITICAL
- Anyone with database access can view/modify any slot

#### user_profiles table
- ✅ Users can view own profile
- ✅ Admins can view all profiles

### Missing RLS Policies
1. **slots table** - No RLS policies (CRITICAL)
2. **audit_logs table** - Admin-only policies exist ✅

---

## TASK 5: PUBLIC PAGE SAFETY

### Current Issues
1. `/api/salons/[bookingLink]` - Returns full business details including owner info
2. `/api/slots` - Exposes slot IDs and business relationships
3. Booking pages expose internal UUIDs in responses

### Required Hardening
1. Sanitize public responses (remove internal IDs)
2. Rate limit public endpoints
3. Add abuse detection logging

---

## TASK 6: ERROR & FAILURE HARDENING

### Current State
- ✅ Generic error messages (good)
- ⚠️ Some routes may leak internal structure
- ⚠️ No specific handling for expired/invalid tokens

### Required Improvements
1. Standardize error responses
2. Add specific handling for security failures
3. Log all unauthorized attempts

---

## TASK 7: LOGGING & AUDITABILITY

### Current State
- ✅ Admin actions logged (audit_logs table)
- ⚠️ Unauthorized access attempts not logged
- ⚠️ Action link usage not audited

### Required Improvements
1. Log all unauthorized access attempts
2. Audit action link usage
3. Monitor suspicious patterns

---

## HARDENING IMPLEMENTATION PLAN

### Phase 1: Critical Action Links (IMMEDIATE)
1. Tokenize accept/reject links
2. Add expiration and one-time use
3. Verify ownership at execution

### Phase 2: Booking Routes (HIGH PRIORITY)
1. Add authorization to `/api/bookings/[id]`
2. Add authorization to `/api/bookings/booking-id/[bookingId]`
3. Tokenize booking status pages

### Phase 3: Owner Routes (HIGH PRIORITY)
1. Tokenize owner dashboard URLs
2. Verify ownership via RLS
3. Add authorization to booking management endpoints

### Phase 4: Slot Management (HIGH PRIORITY)
1. Add RLS policies to slots table
2. Add authorization to reserve/release endpoints
3. Add rate limiting

### Phase 5: Public Routes (MEDIUM PRIORITY)
1. Sanitize public responses
2. Add rate limiting
3. Add abuse detection

---

## SECURITY CONFIDENCE SCORE: 7/10 (After Hardening)

**Breakdown:**
- Route Classification: 8/10 ✅ (All routes classified and documented)
- IDOR Prevention: 7/10 ✅ (Critical routes hardened, some legacy support remains)
- Action Links: 8/10 ✅ (Tokenized and authorized)
- RLS Hardening: 6/10 ⚠️ (Slots RLS migration created, needs execution)
- Public Safety: 7/10 ✅ (Improved, some sanitization needed)
- Error Handling: 8/10 ✅ (Comprehensive security logging)
- Auditability: 7/10 ✅ (Security logging added to critical routes)

**Target Score:** 9/10 (after RLS migration execution)

---

## CRITICAL FIXES REQUIRED

### ✅ COMPLETED
1. ✅ **COMPLETE**: Harden accept/reject action links (tokenized + authorization)
2. ✅ **COMPLETE**: Add authorization to booking UUID routes
3. ✅ **COMPLETE**: Add authorization to bookingId routes
4. ✅ **COMPLETE**: Add authorization to slot reserve/release (rate limited)
5. ✅ **COMPLETE**: Add authorization to booking management APIs
6. ✅ **COMPLETE**: Add security logging to all critical routes
7. ✅ **COMPLETE**: Tokenize accept/reject URLs in WhatsApp messages

### ⚠️ PENDING
1. ⚠️ **PENDING**: Execute RLS migration for slots table (`database/migration_add_slots_rls.sql`)
2. ⚠️ **PENDING**: Tokenize owner dashboard URLs (infrastructure ready, needs client-side integration)
3. ⚠️ **PENDING**: Add client-side secure URL generation for booking status pages
4. ⚠️ **PENDING**: Sanitize public API responses (remove internal IDs)

---

## NOTES

- All fixes must maintain backward compatibility where possible
- RLS is the final authority - all routes must respect RLS
- Tokenization adds security without breaking existing flows
- Authorization checks must happen server-side, never client-side
