# User Journey Testing Guide

## 🎯 Overview

This test suite simulates **real user journeys** through the CusOwn application. Each test script represents a complete user flow from login to completion of actions.

## 📋 Test Scripts

### 01-user-customer-journey.ts

**Customer Complete Journey**

- User logs in as customer
- Browses available businesses
- Views business details
- Views available slots
- Creates booking
- Views their bookings
- Checks booking status

### 02-user-owner-journey.ts

**Owner Complete Journey**

- Owner logs in
- Views dashboard (no business)
- Creates business (setup flow)
- Views their business
- Views bookings
- Accepts bookings
- Views analytics

### 03-user-booking-flow.ts

**Complete Booking Flow**

- User browses and selects business
- Views available slots
- Reserves slot
- Creates booking
- Booking is confirmed
- Verifies final state

### 04-user-payment-flow.ts

**Payment Complete Flow**

- User creates booking requiring payment
- Initiates UPI payment
- Views payment details
- Payment attempt fails (first attempt)
- User retries payment
- Payment succeeds
- Booking automatically confirmed

### 05-user-admin-journey.ts

**Admin Complete Journey**

- Admin logs in
- Views dashboard
- Views all businesses
- Suspends a business
- Views all bookings
- Views analytics
- Views audit logs

### 06-user-concurrent-operations.ts

**Concurrent Operations**

- Multiple users compete for same slot
- User tries to book already reserved slot
- Multiple users browse simultaneously

### 07-user-slot-management.ts

**Slot Management**

- User views available slots
- User reserves a slot
- Slot expires and is released
- Slot is booked (reserved → booked)
- Prevents invalid state transition

### 08-user-error-scenarios.ts

**Error Scenarios**

- Try to book suspended business
- Try to book already booked slot
- Try to confirm already confirmed booking
- Try invalid payment state transition
- Try to access non-existent booking

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install -D ts-node dotenv
```

### 2. Set Up Environment

Create `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

### 3. Run All Tests

```bash
npm run test:all
```

Or use the shell script:

```bash
./scripts/run-all-tests.sh
```

## 📊 Test Output

Each test provides step-by-step output:

```
🧪 Running: STEP 1: Customer logs in
   👤 User Action: Customer logs in
   Customer ID: abc12345...
✅ PASSED: STEP 1: Customer logs in

🧪 Running: STEP 2: Browse available businesses
   👤 User Action: Customer browses businesses
   Found 5 businesses
✅ PASSED: STEP 2: Browse available businesses
```

## ✅ What Gets Tested

### User Flows

- ✅ Customer browsing and booking
- ✅ Owner setup and management
- ✅ Admin operations
- ✅ Complete booking lifecycle
- ✅ Payment processing
- ✅ Concurrent operations
- ✅ Error handling

### Security

- ✅ Business suspension enforcement
- ✅ Race condition prevention
- ✅ State machine enforcement
- ✅ Invalid operation rejection

## 🔧 Troubleshooting

**"No active business found"**
→ Create a business with `suspended = false`

**"No available slot found"**
→ Generate slots for tomorrow

**"Missing Supabase credentials"**
→ Check `.env.local` file

## 📈 Success Criteria

All tests should:

- ✅ Complete without errors
- ✅ Clean up test data
- ✅ Report pass/fail status
- ✅ Simulate real user behavior

**When all tests pass, the system is ready for production!** 🚀
