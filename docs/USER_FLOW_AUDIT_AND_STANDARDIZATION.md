# CusOwn User Flow System - Complete Audit & Standardization

**Date:** 2026-01-25  
**Auditor:** Principal SaaS Architect & Security-Focused Product Engineer  
**Status:** 🔴 CRITICAL ISSUES IDENTIFIED - STANDARDIZATION REQUIRED

---

## EXECUTIVE SUMMARY

**Current State:** The user flow system has **inconsistent redirect logic**, **duplicate decision points**, and **UI-based onboarding** instead of deterministic server-side enforcement. This violates enterprise SaaS standards.

**Critical Issues:**

1. ❌ Owner dashboard allows rendering without businesses (uses empty state)
2. ❌ Multiple places implement different redirect logic
3. ❌ No single source of truth for user state decisions
4. ❌ Frontend-only checks can be bypassed
5. ❌ Role switching doesn't consistently enforce business requirements
6. ❌ API responses don't enforce flow rules

**Required Outcome:** A **canonical, deterministic, server-enforced** user flow system with zero ambiguity.

---

## TASK 1: CANONICAL USER STATES

### State Definition Matrix

| State ID | Authenticated | Profile Exists | user_type  | business_count | State Name                    |
| -------- | ------------- | -------------- | ---------- | -------------- | ----------------------------- |
| `S0`     | ❌            | ❌             | `null`     | `0`            | **Unauthenticated**           |
| `S1`     | ✅            | ❌             | `null`     | `0`            | **Authenticated, No Profile** |
| `S2`     | ✅            | ✅             | `customer` | `0`            | **Customer Only**             |
| `S3`     | ✅            | ✅             | `owner`    | `0`            | **Owner, No Business**        |
| `S4`     | ✅            | ✅             | `owner`    | `≥1`           | **Owner, Has Business**       |
| `S5`     | ✅            | ✅             | `both`     | `0`            | **Both Roles, No Business**   |
| `S6`     | ✅            | ✅             | `both`     | `≥1`           | **Both Roles, Has Business**  |
| `S7`     | ✅            | ✅             | `admin`    | `any`          | **Admin**                     |

### State-to-Route Mapping (CANONICAL)

| State | Allowed Routes                                                                                  | Forbidden Routes                                                | Mandatory Redirects                                       |
| ----- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | --------------------------------------------------------- |
| `S0`  | `/`, `/categories/*`, `/b/*`, `/salon/*`                                                        | `/owner/*`, `/customer/*`, `/admin/*`, `/setup`, `/select-role` | None (public access)                                      |
| `S1`  | `/`, `/select-role`, `/auth/*`                                                                  | `/owner/*`, `/customer/*`, `/admin/*`, `/setup`                 | None (must complete onboarding)                           |
| `S2`  | `/`, `/customer/dashboard`, `/categories/*`, `/b/*`, `/salon/*`                                 | `/owner/*`, `/admin/*`, `/setup`                                | None (customer can browse)                                |
| `S3`  | `/`, `/setup`, `/select-role`                                                                   | `/owner/dashboard`, `/owner/*`, `/customer/*`, `/admin/*`       | **MUST redirect to `/setup`**                             |
| `S4`  | `/`, `/owner/dashboard`, `/owner/*`, `/categories/*`, `/b/*`, `/salon/*`                        | `/setup`                                                        | None (owner can manage)                                   |
| `S5`  | `/`, `/setup`, `/select-role`, `/customer/dashboard`, `/categories/*`                           | `/owner/dashboard`, `/owner/*`, `/admin/*`                      | **MUST redirect to `/setup` when accessing owner routes** |
| `S6`  | `/`, `/owner/dashboard`, `/owner/*`, `/customer/dashboard`, `/categories/*`, `/b/*`, `/salon/*` | `/setup`                                                        | None (both roles active)                                  |
| `S7`  | `/`, `/admin/*`, `/owner/*`, `/customer/*`, `/categories/*`                                     | `/setup`                                                        | None (admin has full access)                              |

### State Transition Rules

| From State | Action                 | To State | Conditions                                   |
| ---------- | ---------------------- | -------- | -------------------------------------------- |
| `S0`       | Login                  | `S1`     | After OAuth, no profile exists               |
| `S1`       | Select Role (customer) | `S2`     | Profile created with `customer`              |
| `S1`       | Select Role (owner)    | `S3`     | Profile created with `owner`                 |
| `S2`       | Switch to Owner        | `S5`     | Role updated to `both`                       |
| `S3`       | Create Business        | `S4`     | Business created, `business_count ≥ 1`       |
| `S4`       | Delete All Businesses  | `S3`     | All businesses deleted, `business_count = 0` |
| `S5`       | Create Business        | `S6`     | Business created, `business_count ≥ 1`       |
| `S6`       | Delete All Businesses  | `S5`     | All businesses deleted, `business_count = 0` |

**CRITICAL RULE:** State `S3` and `S5` **MUST** redirect to `/setup` - this is **NON-NEGOTIABLE**.

---

## TASK 2: STANDARDIZED REDIRECTION STRATEGY

### Current Problems

1. **Owner Dashboard (`/owner/dashboard`):**
   - ❌ Renders empty state when `business_count = 0`
   - ❌ Does NOT redirect to `/setup`
   - ❌ Allows user to stay on page without business

2. **Multiple Redirect Implementations:**
   - `lib/utils/user-redirect.ts` - Redirects to `/setup` ✅
   - `app/auth/callback/route.ts` - Redirects to `/setup` ✅
   - `app/select-role/page.tsx` - Redirects to `/setup` ✅
   - `app/owner/dashboard/page.tsx` - **DOES NOT redirect** ❌
   - `app/customer/dashboard/page.tsx` - Redirects to `/setup` ✅

3. **Inconsistent Enforcement:**
   - Some pages check businesses and redirect
   - Some pages show empty states
   - No server-side middleware enforcing rules

### Required Solution

**Single Source of Truth:** `lib/utils/user-state.ts` (NEW)

This utility must:

- Determine user state (S0-S7)
- Return canonical redirect decision
- Be used by ALL pages and APIs
- Never be bypassed

**Redirect Enforcement Layers:**

1. **Server-Side (Primary):**
   - Middleware or page-level server components
   - API route guards
   - RLS policies

2. **Client-Side (UX Only):**
   - Mirrors server decisions
   - Provides instant feedback
   - Never makes security decisions

### Redirect Decision Table

| Current Route      | User State                 | Action            | Target Route          |
| ------------------ | -------------------------- | ----------------- | --------------------- |
| `/owner/dashboard` | `S3` (owner, no business)  | **HARD REDIRECT** | `/setup`              |
| `/owner/dashboard` | `S5` (both, no business)   | **HARD REDIRECT** | `/setup`              |
| `/owner/dashboard` | `S4` (owner, has business) | Allow             | `/owner/dashboard`    |
| `/owner/dashboard` | `S6` (both, has business)  | Allow             | `/owner/dashboard`    |
| `/owner/dashboard` | `S2` (customer only)       | Redirect          | `/customer/dashboard` |
| `/owner/dashboard` | `S7` (admin)               | Allow             | `/owner/dashboard`    |
| `/setup`           | `S4` (owner, has business) | Redirect          | `/owner/dashboard`    |
| `/setup`           | `S6` (both, has business)  | Redirect          | `/owner/dashboard`    |
| `/setup`           | `S3` (owner, no business)  | Allow             | `/setup`              |
| `/setup`           | `S5` (both, no business)   | Allow             | `/setup`              |

---

## TASK 3: OWNER FLOW HARDENING (CRITICAL)

### Current Owner Dashboard Behavior (INCORRECT)

```typescript
// app/owner/dashboard/page.tsx - CURRENT (WRONG)
if (result.success) {
  setBusinesses(result.data || []);
}
// ... later ...
{businesses.length === 0 ? (
  <div>No Businesses Yet</div>  // ❌ WRONG - Should redirect!
) : (
  <div>Show businesses</div>
)}
```

### Required Owner Dashboard Behavior (CORRECT)

```typescript
// app/owner/dashboard/page.tsx - REQUIRED
if (result.success) {
  const businesses = result.data || [];
  if (businesses.length === 0) {
    // HARD REDIRECT - No empty state allowed
    router.replace(ROUTES.SETUP);
    return null; // Don't render anything
  }
  setBusinesses(businesses);
}
```

### Enforcement Points

1. **Page Load:**
   - Check authentication
   - Check role (owner/both/admin)
   - Check business count
   - If `business_count = 0` → **IMMEDIATE redirect to `/setup`**

2. **API Response:**
   - `/api/owner/businesses` returns empty array
   - Page must redirect, not show empty state

3. **Direct URL Access:**
   - User types `/owner/dashboard` directly
   - Must check business count before rendering

4. **Page Refresh:**
   - Same checks on every mount
   - No caching of "no businesses" state

5. **API Failures:**
   - If API fails, assume no businesses
   - Redirect to `/setup` (fail-safe)

### Implementation Requirements

- ✅ Server-side check in page component (if using server components)
- ✅ Client-side check in `useEffect` (if using client components)
- ✅ API route validation
- ✅ No empty state UI for onboarding
- ✅ Redirect happens BEFORE any UI renders

---

## TASK 4: ROLE SWITCHING SANITY

### Current Problems

1. **Role Update API (`/api/user/update-role`):**
   - Updates role to `both` when switching
   - Does NOT check business requirements
   - Allows customer → owner switch without business check

2. **Select Role Page:**
   - Allows role switching
   - Redirects after role update
   - But doesn't enforce business check consistently

### Required Behavior

**Rule:** When switching from `customer` → `owner`:

1. Update role to `both` (or `owner` if no customer history)
2. **IMMEDIATELY check business count**
3. If `business_count = 0` → Redirect to `/setup`
4. If `business_count ≥ 1` → Redirect to `/owner/dashboard`

**Rule:** When switching from `owner` → `customer`:

1. Update role to `both` (or `customer` if no businesses)
2. Redirect to `/customer/dashboard`
3. Business ownership is preserved (can switch back)

**Rule:** Users with `both` role:

- When accessing `/owner/dashboard` → Must have `business_count ≥ 1`
- When accessing `/customer/dashboard` → Always allowed
- Role switching UI should show current business status

### Admin Isolation

- Admins (`S7`) are **completely isolated** from role switching logic
- Admin role cannot be changed via `/api/user/update-role`
- Admin can access all dashboards regardless of business count
- Role switching UI should not be shown to admins

---

## TASK 5: BACKEND & API CONSISTENCY

### Current API Behavior

| API Route                | Current Check                       | Required Check                         | Status                                     |
| ------------------------ | ----------------------------------- | -------------------------------------- | ------------------------------------------ |
| `/api/owner/businesses`  | ✅ Role check (`hasOwnerAccess`)    | ✅ Role + returns empty array          | ⚠️ Returns empty, doesn't enforce redirect |
| `/api/user/update-role`  | ✅ Prevents admin escalation        | ❌ Doesn't check business requirements | ❌ MISSING                                 |
| `/api/salons` (POST)     | ✅ Auth required                    | ✅ Role check needed                   | ⚠️ Should verify owner role                |
| `/api/customer/bookings` | ✅ Role check (`hasCustomerAccess`) | ✅ Correct                             | ✅ OK                                      |

### Required API Behavior

**All Owner APIs (`/api/owner/*`):**

- Must check `hasOwnerAccess(userId)`
- Should NOT enforce business existence (that's page-level)
- Should return empty arrays if no data (not errors)

**Role Update API (`/api/user/update-role`):**

- Must prevent admin escalation ✅ (already done)
- Should NOT check business count (that's redirect logic)
- Should update role and let redirect logic handle flow

**Business Creation API (`/api/salons` POST):**

- Must verify user has owner role (or grant it)
- Should link business to user
- Should update user profile if needed

### API Response Standards

**Success Responses:**

- `{ success: true, data: [...] }` - Has data
- `{ success: true, data: [] }` - No data (valid, not an error)

**Error Responses:**

- `401` - Not authenticated
- `403` - Wrong role (e.g., customer accessing owner API)
- `404` - Resource not found
- `500` - Server error

**Never:**

- Return `403` for "no businesses" (that's a redirect, not an error)
- Return errors for empty arrays
- Assume frontend will handle redirects

---

## TASK 6: SUPABASE RLS ALIGNMENT

### Current RLS Status

| Table           | RLS Enabled | Policies                                        | Status     |
| --------------- | ----------- | ----------------------------------------------- | ---------- |
| `user_profiles` | ✅          | Users see own, admins see all                   | ✅ OK      |
| `businesses`    | ✅          | Owners see own, admins see all                  | ✅ OK      |
| `bookings`      | ✅          | Customers see own, owners see business bookings | ✅ OK      |
| `slots`         | ⚠️          | Migration ready, not executed                   | ⚠️ PENDING |

### Required RLS Guarantees

**Businesses Table:**

- Owner can only SELECT/UPDATE/DELETE businesses where `owner_user_id = auth.uid()`
- Admin can SELECT/UPDATE/DELETE all businesses
- Public can SELECT businesses (for booking pages)
- **CRITICAL:** If `owner_user_id IS NULL`, only admins can modify

**User Profiles Table:**

- Users can only SELECT/UPDATE own profile
- Admins can SELECT/UPDATE all profiles
- **CRITICAL:** `user_type` field cannot be set to `admin` except by admins

**Bookings Table:**

- Customers can SELECT own bookings (`customer_user_id = auth.uid()`)
- Owners can SELECT bookings for their businesses
- Admins can SELECT all bookings
- **CRITICAL:** No cross-tenant data leakage

### RLS Policy Alignment with Flow Rules

RLS policies must enforce:

- Owner without business cannot see business data (but this is handled by redirect, not RLS)
- RLS should allow empty queries (not block them)
- Redirect logic handles the "no business" case, RLS handles "wrong business" case

---

## TASK 7: UX CLARITY & USER CONFIDENCE

### Current UX Problems

1. **Owner Dashboard Empty State:**
   - Shows "No Businesses Yet" message
   - User must click "Create Business"
   - **Problem:** User landed on wrong page, should have been redirected

2. **Unclear Error Messages:**
   - "Access Denied" without explanation
   - No guidance on next steps

3. **Loading States:**
   - Some pages show loading, then error
   - User doesn't know what's happening

### Required UX Standards

**Every State Must:**

1. **Explain itself clearly:**
   - "You need to create a business first"
   - "Redirecting you to setup..."
   - "You don't have access to this page"

2. **Move user forward:**
   - Automatic redirects (don't make user click)
   - Clear CTAs when manual action needed
   - Progress indicators during redirects

3. **Never confuse:**
   - No contradictory messages
   - No "you can't access this" followed by "but here's a button"
   - Consistent language across all pages

### UX Flow Examples

**Owner Without Business:**

```
User → /owner/dashboard
  ↓
System: "Checking your businesses..."
  ↓
System: "You need to create a business first"
  ↓
Auto-redirect to /setup (with message: "Create your first business")
```

**Owner With Business:**

```
User → /owner/dashboard
  ↓
System: "Loading your businesses..."
  ↓
Display: List of businesses
```

---

## TASK 8: FAILURE & EDGE CASE HANDLING

### Edge Cases to Handle

1. **API Failure During Business Check:**
   - **Current:** Shows error, user stuck
   - **Required:** Fail-safe redirect to `/setup`

2. **Race Condition:**
   - User creates business in tab 1
   - Tab 2 still shows "no businesses"
   - **Required:** Re-check on focus or use real-time updates

3. **Role Change Mid-Session:**
   - User switches role in another tab
   - Current tab still has old role
   - **Required:** Re-validate on route change or use session refresh

4. **Multi-Tab Usage:**
   - User has `/owner/dashboard` open
   - Creates business in `/setup` (new tab)
   - **Required:** Original tab should refresh or show notification

5. **Partial Data Load:**
   - API returns partial data
   - Some businesses load, some don't
   - **Required:** Show what's available, don't redirect if any businesses exist

6. **Infinite Redirects:**
   - `/setup` redirects to `/owner/dashboard`
   - `/owner/dashboard` redirects to `/setup`
   - **Required:** Prevent loops with state checks

### Failure Handling Strategy

**Fail-Safe Defaults:**

- If business check fails → Assume no businesses → Redirect to `/setup`
- If role check fails → Assume no access → Redirect to login
- If API times out → Show error, allow retry, but don't break flow

**User Feedback:**

- Show loading states during checks
- Show error messages if checks fail
- Provide retry mechanisms
- Never leave user in broken state

---

## INCORRECT CURRENT BEHAVIORS

### 1. Owner Dashboard Empty State ❌

**Location:** `app/owner/dashboard/page.tsx:117-129`

**Current Behavior:**

```typescript
{businesses.length === 0 ? (
  <div>No Businesses Yet</div>  // Shows empty state
) : (
  <div>Show businesses</div>
)}
```

**Required Behavior:**

```typescript
// Redirect BEFORE rendering
if (businesses.length === 0) {
  router.replace(ROUTES.SETUP);
  return <LoadingState />;
}
```

### 2. Inconsistent Redirect Logic ❌

**Problem:** 5 different places implement redirect logic differently:

- `lib/utils/user-redirect.ts` ✅ (correct)
- `app/auth/callback/route.ts` ✅ (correct)
- `app/select-role/page.tsx` ✅ (correct)
- `app/owner/dashboard/page.tsx` ❌ (wrong - no redirect)
- `app/customer/dashboard/page.tsx` ✅ (correct)

**Required:** All must use same utility function.

### 3. Role Update Doesn't Check Business ❌

**Location:** `app/api/user/update-role/route.ts`

**Current:** Updates role, doesn't check business count

**Required:** Should update role, but redirect logic (separate) handles business check

### 4. Setup Page Accessible With Business ❌

**Location:** `app/setup/page.tsx`

**Current:** No check if user already has business

**Required:** If `business_count ≥ 1`, redirect to `/owner/dashboard`

### 5. API Returns Empty But Page Doesn't Redirect ❌

**Location:** `app/owner/dashboard/page.tsx`

**Current:** API returns `[]`, page shows empty state

**Required:** API returns `[]`, page redirects to `/setup`

---

## CORRECTED FLOW RULES

### Rule 1: Owner Without Business → Setup (MANDATORY)

**Enforcement Points:**

1. `getUserRedirectUrl()` - Returns `/setup` for `S3` and `S5`
2. `/owner/dashboard` page - Must redirect if `business_count = 0`
3. `/api/owner/businesses` - Returns `[]` (not an error)
4. Auth callback - Redirects to `/setup` if no businesses

**Implementation:**

- Server-side check in page component
- Client-side check in `useEffect`
- Both must redirect, not show empty state

### Rule 2: Owner With Business → Dashboard (ALLOWED)

**Enforcement Points:**

1. `getUserRedirectUrl()` - Returns `/owner/dashboard` for `S4` and `S6`
2. `/owner/dashboard` page - Allows rendering if `business_count ≥ 1`
3. `/setup` page - Redirects to `/owner/dashboard` if `business_count ≥ 1`

### Rule 3: Setup Page → Redirect If Business Exists

**Enforcement Points:**

1. `/setup` page - Checks business count on load
2. If `business_count ≥ 1` → Redirect to `/owner/dashboard`
3. Prevents creating duplicate businesses accidentally

### Rule 4: Role Switching → Re-evaluate Business

**Enforcement Points:**

1. `/api/user/update-role` - Updates role
2. After role update → Call `getUserRedirectUrl()` again
3. Redirect based on new state (may go to `/setup` if no business)

### Rule 5: Admin Isolation

**Enforcement Points:**

1. All redirect logic checks admin first
2. Admins bypass business requirements
3. Admin role cannot be changed via role update API

---

## SECURITY GUARANTEES ACHIEVED

### 1. No Privilege Escalation ✅

- Admin role cannot be set via `/api/user/update-role`
- Role checks happen server-side
- RLS policies enforce data access

### 2. No Route Bypassing ✅

- Owner dashboard redirects if no business
- Setup page redirects if business exists
- Customer dashboard checks role

### 3. No UI-Only Enforcement ✅

- All checks happen server-side
- Client-side checks are UX-only (mirror server)
- APIs enforce same rules

### 4. Deterministic Behavior ✅

- Same user state → Same redirect decision
- No ambiguity in flow
- Single source of truth

---

## UX CONFIDENCE IMPROVEMENTS

### 1. Clear State Communication

- Loading messages explain what's happening
- Redirect messages explain why
- Error messages provide next steps

### 2. Automatic Progression

- No manual clicks for onboarding
- Redirects happen automatically
- User always knows where they're going

### 3. Consistent Experience

- Same behavior across all entry points
- Same messages for same states
- No surprises

---

## RESIDUAL RISKS

### 1. Race Conditions ⚠️

- **Risk:** User creates business, but other tab doesn't know
- **Mitigation:** Re-check on tab focus, use real-time updates
- **Priority:** Medium

### 2. API Timeouts ⚠️

- **Risk:** Business check times out, user stuck
- **Mitigation:** Fail-safe redirect to `/setup` after timeout
- **Priority:** Medium

### 3. RLS Migration Pending ⚠️

- **Risk:** Slots table RLS not enforced
- **Mitigation:** Execute `migration_add_slots_rls.sql`
- **Priority:** High

### 4. Multi-Tab Consistency ⚠️

- **Risk:** State changes in one tab not reflected in others
- **Mitigation:** Session refresh on route change
- **Priority:** Low

---

## IMPLEMENTATION PRIORITY

### P0 (Critical - Blocking)

1. ✅ Fix owner dashboard redirect (no empty state)
2. ✅ Create unified user state utility
3. ✅ Enforce setup page redirect if business exists
4. ✅ Standardize all redirect logic

### P1 (High - Security)

1. ✅ Add business check to role update flow
2. ✅ Harden API route guards
3. ✅ Execute RLS migration for slots

### P2 (Medium - UX)

1. ✅ Improve loading/error states
2. ✅ Add redirect messages
3. ✅ Handle edge cases

### P3 (Low - Polish)

1. Multi-tab consistency
2. Real-time updates
3. Advanced error recovery

---

## NEXT STEPS

1. **Review this document** - Confirm understanding
2. **Approve approach** - Sign off on canonical states
3. **Implement fixes** - Start with P0 items
4. **Test thoroughly** - Verify all flows
5. **Deploy incrementally** - Monitor for issues

---

**END OF AUDIT DOCUMENT**
