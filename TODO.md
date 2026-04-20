# TypeScript Error Fix TODO

## Status: Complete - 0 TS errors

### 1. ✅ Create TODO.md [COMPLETED]

### 2. Fix Prop Interfaces (TS2322) ✅

- [x] components/setup/create-business-form.tsx: Add props to function signature
- [x] components/profile/profile-page-content.tsx: Fix/remove unused fromOwner
- [x] app/(dashboard)/admin/dashboard/dashboard-client.tsx: Remove unused initialTab

### 3. Fix Function Argument Counts (TS2554)

- [x] app/api/admin/bookings/[id]/route.ts: Remove extra 'request' from notifyCustomer
- [x] app/api/payments/create/route.ts: Fix createPayment args (remove paymentType)
- [x] app/api/admin/businesses/[id]/route.ts: Fix notifyBusinessOwner args ✅
- [x] app/api/bookings/[id]/accept/route.ts: Fix args ✅

### 4. Remove Unused Declarations (TS6133)

- [x] All analytics components: Remove unused React imports
- [x] lib/events/event-handlers.ts: Remove unused { booking }, { slot } params ✅
- [ ] API routes: Rename/remove unused 'request' params
- [ ] lib/cache/next-cache.ts: Fix/remove unused businessId, bookingLink
- [ ] lib/auth/cookie-adapter.server.ts: Remove unused value param
- [ ] All other lib files (20+): Remove unused vars/params

### 5. Remove Unused Types/Interfaces

- [ ] lib/hooks/use-monitored-fetch.ts: Remove unused FetchState

### 6. Verification

- [ ] Run `npm run typecheck` - expect 0 errors
- [ ] Test business creation flow
- [ ] Test booking accept/reject
- [ ] Test payment creation

### 7. Completion

- [ ] attempt_completion
