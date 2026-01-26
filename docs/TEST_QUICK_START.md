# Quick Start - Running Tests

## Prerequisites

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Set up environment:**
   Create `.env.local` with:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Ensure database has data:**
   - At least one active business (not suspended)
   - At least one available slot for tomorrow

## Run All Tests

```bash
npm run test:all
```

This will run all 8 test suites sequentially:
1. ✅ Atomic Booking Creation
2. ✅ State Machines
3. ✅ Business Suspension
4. ✅ Abuse Detection
5. ✅ Atomic Confirmation
6. ✅ Concurrent Bookings
7. ✅ Payment Flow
8. ✅ Slot Operations

## Run Individual Tests

```bash
npm run test:atomic-booking    # Test atomic booking creation
npm run test:state-machines    # Test state machine enforcement
npm run test:suspension        # Test business suspension
npm run test:abuse             # Test abuse detection
npm run test:confirmation      # Test atomic confirmation
npm run test:concurrent        # Test concurrent bookings
npm run test:payment           # Test payment flow
npm run test:slots             # Test slot operations
```

## What Gets Tested

All tests use **real data** from your database:
- ✅ Real businesses
- ✅ Real slots
- ✅ Real database connections

Tests automatically:
- ✅ Clean up after themselves
- ✅ Report pass/fail status
- ✅ Provide detailed error messages

## Troubleshooting

**"No active business found"**
→ Create a business in your database with `suspended = false`

**"No available slot found"**
→ Generate slots for tomorrow or use existing available slots

**"Missing Supabase credentials"**
→ Check `.env.local` file exists and has correct values

## Next Steps

After running tests, check:
- ✅ All tests pass
- ✅ No errors in output
- ✅ Database is clean (test data removed)

For detailed documentation, see [README.md](./README.md)
