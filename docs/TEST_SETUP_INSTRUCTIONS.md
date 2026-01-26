# Test Scripts Setup Instructions

## ⚠️ IMPORTANT: Database Migration Required

Before running tests, you **MUST** run this migration in your Supabase SQL editor:

```sql
-- Add updated_at column to slots table
ALTER TABLE slots ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Create trigger to auto-update updated_at
CREATE TRIGGER update_slots_updated_at 
  BEFORE UPDATE ON slots
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();
```

**File:** `database/migration_add_slots_updated_at.sql`

## Quick Setup

1. **Install dependencies:**
   ```bash
   npm install -D ts-node dotenv
   ```

2. **Set up environment:**
   Create `.env.local`:
   ```bash
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

3. **Run database migration:**
   - Open Supabase SQL Editor
   - Run `database/migration_add_slots_updated_at.sql`
   - Also ensure `database/migration_atomic_booking_creation.sql` and `database/migration_atomic_booking_confirmation.sql` are run

4. **Run tests:**
   ```bash
   npm run test:all
   ```

## Test Scripts

### Core User Flows
- `01-user-customer-journey.ts` - Customer flow
- `02-user-owner-journey.ts` - Owner flow  
- `05-user-admin-journey.ts` - Admin flow

### Admin Multi-Role Flows
- `09-user-admin-as-customer.ts` - Admin as customer
- `10-user-admin-as-owner.ts` - Admin as owner

### Additional Flows
- `03-user-booking-flow.ts` - Complete booking
- `04-user-payment-flow.ts` - Payment flow
- `06-user-concurrent-operations.ts` - Concurrent ops
- `07-user-slot-management.ts` - Slot management
- `08-user-error-scenarios.ts` - Error handling

## Troubleshooting

**"column updated_at does not exist"**
→ Run `database/migration_add_slots_updated_at.sql`

**"Cannot find module test-utils"**
→ Ensure you're in the project root when running tests

**"No active business found"**
→ Create a business with `suspended = false`

**"No available slot found"**
→ Generate slots for tomorrow
