# User Journey Test Scripts

This directory contains comprehensive **user journey test scripts** that simulate real user flows through the CusOwn application.

## 🎯 Testing Philosophy

These tests simulate **real user behavior**:

- ✅ User logs in
- ✅ User navigates through the application
- ✅ User performs actions (browse, book, pay, manage)
- ✅ User views different tabs and sections
- ✅ Tests complete flows from start to finish

## 📋 Test Scripts

### 01-user-customer-journey.ts

**Customer Flow** - Complete customer journey:

- ✅ Customer logs in
- ✅ Browses available businesses
- ✅ Views business details
- ✅ Views available slots
- ✅ Creates booking
- ✅ Views their bookings
- ✅ Checks booking status

### 02-user-owner-journey.ts

**Owner Flow** - Complete owner journey:

- ✅ Owner logs in
- ✅ Views dashboard (no business)
- ✅ Creates business (setup flow)
- ✅ Views their business
- ✅ Views bookings
- ✅ Accepts bookings
- ✅ Views analytics

### 03-user-booking-flow.ts

**Complete Booking Flow** - End-to-end booking process:

- ✅ User browses and selects business
- ✅ Views available slots
- ✅ Reserves slot
- ✅ Creates booking
- ✅ Initiates payment
- ✅ Payment is verified
- ✅ Booking is confirmed
- ✅ Verifies final state

### 04-user-payment-flow.ts

**Payment Flow** - Complete payment process:

- ✅ User creates booking requiring payment
- ✅ Initiates UPI payment
- ✅ Views payment details
- ✅ Payment attempt fails (first attempt)
- ✅ User retries payment
- ✅ Payment succeeds on third attempt
- ✅ Booking automatically confirmed

### 05-user-admin-journey.ts

**Admin Flow** - Admin operations:

- ✅ Admin logs in
- ✅ Views dashboard
- ✅ Views all businesses
- ✅ Suspends a business
- ✅ Views all bookings
- ✅ Views analytics
- ✅ Views audit logs

### 06-user-concurrent-operations.ts

**Concurrent Operations** - Race condition tests:

- ✅ Multiple users compete for same slot
- ✅ User tries to book already reserved slot
- ✅ Multiple users browse simultaneously

### 07-user-slot-management.ts

**Slot Management** - Slot operations:

- ✅ User views available slots
- ✅ User reserves a slot
- ✅ Slot expires and is released
- ✅ Slot is booked (reserved → booked)
- ✅ Prevents invalid state transition

### 08-user-error-scenarios.ts

**Error Scenarios** - Error handling:

- ✅ Try to book suspended business
- ✅ Try to book already booked slot
- ✅ Try to confirm already confirmed booking
- ✅ Try invalid payment state transition
- ✅ Try to access non-existent booking

## 🚀 Running Tests

### Run All Tests

```bash
npm run test:all
```

This runs all 8 user journey tests sequentially, simulating complete user flows.

### Run Individual Tests

```bash
npm run test:customer-journey    # Customer flow
npm run test:owner-journey        # Owner flow
npm run test:booking-flow         # Complete booking
npm run test:payment-flow         # Payment process
npm run test:admin-journey        # Admin operations
npm run test:concurrent-ops       # Concurrent operations
npm run test:slot-management      # Slot management
npm run test:error-scenarios      # Error handling
```

## 📊 Test Output

Each test provides:

- ✅ Step-by-step user actions
- ✅ Pass/fail status for each step
- ✅ Detailed error messages
- ✅ Summary statistics

Example output:

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

## 🔧 Prerequisites

1. **Environment Variables**: `.env.local` must contain:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. **Dependencies**: Install test dependencies:

   ```bash
   npm install -D ts-node dotenv
   ```

3. **Database**: Ensure your database has:
   - At least one active business (not suspended)
   - At least one available slot for tomorrow
   - Required migrations applied

## 🧹 Test Cleanup

All tests automatically clean up after themselves:

- ✅ Test bookings are deleted
- ✅ Test slots are reset
- ✅ Test payments are removed
- ✅ Test users are preserved (for reuse)

## 📝 Test Data

All tests use **real data** from your Supabase database:

- Real businesses
- Real slots
- Real database connections
- Test users are created if needed

## 🎯 Coverage

These tests cover:

- ✅ **Authentication** - User login and session
- ✅ **Business Browsing** - Search and view businesses
- ✅ **Booking Creation** - Complete booking flow
- ✅ **Payment Processing** - Payment initiation to completion
- ✅ **Owner Operations** - Business management
- ✅ **Admin Operations** - System administration
- ✅ **Concurrent Operations** - Race conditions
- ✅ **Error Handling** - Edge cases and errors

## 🔍 Troubleshooting

**"No active business found"**
→ Create a business in your database with `suspended = false`

**"No available slot found"**
→ Generate slots for tomorrow or use existing available slots

**"Missing Supabase credentials"**
→ Check `.env.local` file exists and has correct values

**TypeScript errors**
→ Run `npm install -D ts-node dotenv` to install dependencies

## 📈 Continuous Integration

These tests can be integrated into CI/CD:

```yaml
# Example GitHub Actions
- name: Run User Journey Tests
  run: npm run test:all
  env:
    NEXT_PUBLIC_SUPABASE_URL: ${{ secrets.SUPABASE_URL }}
    SUPABASE_SERVICE_ROLE_KEY: ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}
```

## 🎉 Success Criteria

All tests should:

- ✅ Complete without errors
- ✅ Clean up test data
- ✅ Report pass/fail status
- ✅ Provide detailed output

**System is ready for production when all tests pass!** 🚀
