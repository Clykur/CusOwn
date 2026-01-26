# How to Run Security Migrations

## Step-by-Step Instructions

### 1. Open Supabase SQL Editor

1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"

### 2. Run Migration 1: Slots RLS

Copy and paste the entire contents of:
```
database/migration_add_slots_rls.sql
```

Then click "Run" (or press Cmd/Ctrl + Enter)

**Expected Result:** Should complete without errors. You'll see "Success. No rows returned"

### 3. Run Migration 2: Default DENY RLS

Copy and paste the entire contents of:
```
database/migration_add_default_deny_rls.sql
```

Then click "Run"

**Expected Result:** Should complete without errors

### 4. Run Migration 3: Update Audit Logs Actions

Copy and paste the entire contents of:
```
database/migration_update_audit_logs_actions.sql
```

Then click "Run"

**Expected Result:** Should complete without errors

---

## Troubleshooting

### If you get "constraint does not exist" error:

This is normal for `migration_update_audit_logs_actions.sql`. The migration uses `DROP CONSTRAINT IF EXISTS` which is safe.

### If you get "policy already exists" error:

This is normal. The migrations use `DROP POLICY IF EXISTS` which handles this.

### If you get "table does not exist" error:

Make sure you've run the base migrations first:
- `database/migration_add_audit_logs.sql` (for audit_logs table)
- `database/schema.sql` (for other tables)

### If you get permission errors:

Make sure you're running these as a database admin or using the Supabase SQL Editor (which has admin privileges).

---

## Verification

After running all migrations, verify RLS is enabled:

```sql
SELECT tablename, rowsecurity 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('slots', 'businesses', 'bookings', 'user_profiles', 'audit_logs');
```

All tables should show `rowsecurity = true`.

---

## Alternative: Run All at Once

You can also combine all three migrations into one query:

1. Copy contents of `migration_add_slots_rls.sql`
2. Copy contents of `migration_add_default_deny_rls.sql`  
3. Copy contents of `migration_update_audit_logs_actions.sql`
4. Paste all three into SQL Editor
5. Run
