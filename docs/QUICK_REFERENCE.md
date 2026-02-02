# Quick Reference Guide

## Cron Jobs

### Health Check

```bash
# Test locally
curl -X GET http://localhost:3000/api/cron/health-check \
  -H "Authorization: Bearer YOUR_CRON_SECRET"

# Or use test script
./scripts/test-cron.sh health
```

### All Cron Jobs

```bash
./scripts/test-cron.sh [reminders|expire|cleanup|health]
```

---

## Metrics Endpoint

### Access Success Metrics (Admin Only)

**Via Admin Dashboard:**

1. Log in as admin
2. Go to `/admin/dashboard`
3. Click "Success Metrics" tab

**Via API:**

```bash
curl http://localhost:3000/api/metrics/success?include_alerts=true \
  -H "Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN"
```

**Query Parameters:**

- `start_date` (optional): YYYY-MM-DD format
- `end_date` (optional): YYYY-MM-DD format
- `include_alerts` (optional): true/false

---

## Environment Variables

**Required:**

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=...
CRON_SECRET=...
```

**Optional:**

```bash
NEXT_PUBLIC_SENTRY_DSN=...
EMAIL_SERVICE_URL=...
EMAIL_API_KEY=...
TWILIO_ACCOUNT_SID=...
TWILIO_AUTH_TOKEN=...
TWILIO_PHONE_NUMBER=...
```

---

## Database Migrations

**Run in order:**

1. `schema.sql` (base schema)
2. `migration_*.sql` (in chronological order)
3. `migration_optimize_queries.sql`
4. `migration_add_metrics.sql`
5. `migration_phase3_analytics.sql`
6. `migration_add_success_metrics.sql`

---

## Key Endpoints

- `/api/health` - Health check (public)
- `/api/metrics` - Application metrics (admin)
- `/api/metrics/success` - Success metrics (admin)
- `/api/cron/health-check` - Scheduled health check (cron)
- `/api/cron/send-reminders` - Send reminders (cron)
- `/api/cron/expire-bookings` - Expire bookings (cron)
- `/api/cron/cleanup-reservations` - Cleanup reservations (cron)

---

## Admin Access

**Set Admin:**

```sql
UPDATE user_profiles SET user_type = 'admin' WHERE id = 'USER_ID';
```

**Verify Admin:**

```bash
GET /api/admin/check-status
Authorization: Bearer YOUR_AUTH_TOKEN
```
