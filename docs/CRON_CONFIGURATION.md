# Cron Jobs Configuration - Complete ✅

**Scheduling:** Crons are run by **GitHub Actions** (not Vercel). See `.github/workflows/scheduled-crons.yml`.  
Add repo secrets: `CRON_SECRET`, `CRON_APP_URL` (e.g. `https://your-app.vercel.app`).

---

## ✅ Configured Cron Jobs

### 1. Health Check (NEW)

- **Endpoint**: `/api/cron/health-check`
- **Schedule**: Every 5 minutes (`*/5 * * * *`)
- **Purpose**: Monitor application health and track uptime
- **Method**: GET or POST
- **Auth**: Bearer token with `CRON_SECRET`

### 2. Send Reminders

- **Endpoint**: `/api/cron/send-reminders`
- **Schedule**: Every 5 minutes (`*/5 * * * *`)
- **Purpose**: Send booking reminders (24h and 2h before)

### 3. Expire Bookings

- **Endpoint**: `/api/cron/expire-bookings`
- **Schedule**: Every hour (`0 * * * *`)
- **Purpose**: Expire old pending bookings

### 4. Cleanup Reservations

- **Endpoint**: `/api/cron/cleanup-reservations`
- **Schedule**: Every 10 minutes (`*/10 * * * *`)
- **Purpose**: Release expired slot reservations

---

## ✅ Scheduling (GitHub Actions)

**File**: `.github/workflows/scheduled-crons.yml`

- Workflow runs every 15 minutes (schedule: `*/15 * * * *`)
- **Every 15 min:** trim-metric-timings, expire-payments
- **01:00 UTC:** expire-bookings
- **02:00 UTC:** cleanup-reservations
- **03:00 UTC:** health-check
- **09:00 UTC:** send-reminders

**Required repo Secrets:** `CRON_SECRET`, `CRON_APP_URL`  
**Vercel crons:** Disabled (empty `vercel.json`). Use this workflow or any external cron that calls the same API endpoints with `Authorization: Bearer <CRON_SECRET>`.

---

## ✅ Metrics Endpoint

**Endpoint**: `/api/metrics/success`

- **Access**: Admin only
- **Authentication**: Required (Supabase auth)
- **Authorization**: Admin role check
- **Response**: Success metrics with thresholds and alerts

**Usage:**

```bash
# Get success metrics
GET /api/metrics/success?start_date=2026-01-01&end_date=2026-01-25&include_alerts=true
Authorization: Bearer YOUR_AUTH_TOKEN
```

**Response Includes:**

- Technical metrics (API response time, uptime, error rate, DB query time)
- Business metrics (support reduction, no-show rate, retention, completion)
- Threshold status (pass/fail for each metric)
- Alerts (if include_alerts=true)

---

## Setup Instructions

### 1. Environment Variable

**Add to `.env.local` and Vercel:**

```bash
CRON_SECRET=your-random-secret-key-here
```

**Generate Secret:**

```bash
openssl rand -base64 32
```

### 2. Deploy to Vercel

**Automatic Setup:**

- `vercel.json` already configured
- Deploy: `vercel deploy`
- Cron jobs start automatically

### 3. Verify Health Checks

**Test Locally:**

```bash
curl -X GET http://localhost:3000/api/cron/health-check \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Check in Production:**

- Vercel Dashboard → Cron Jobs
- Verify health check runs every 5 minutes
- Check execution logs

### 4. Access Metrics

**As Admin:**

1. Log in as admin user
2. Navigate to Admin Dashboard
3. Click "Success Metrics" tab
4. Or access directly: `/api/metrics/success`

**Via API:**

```bash
curl http://localhost:3000/api/metrics/success \
  -H "Authorization: Bearer YOUR_AUTH_TOKEN"
```

---

## Monitoring

### Health Check Metrics

- Stored in `metric_timings` table
- Metric: `health.check`
- Uptime calculated from last 24 hours
- Alerts if uptime < 99.9%

### Cron Job Status

- Check Vercel dashboard → Cron Jobs
- Review execution history
- Monitor success/failure rates
- Set up alerts for failures

---

## Verification Checklist

- [x] Health check cron configured in `vercel.json`
- [x] Health check endpoint accepts GET and POST
- [x] CRON_SECRET authentication implemented
- [x] Metrics endpoint secured (admin only)
- [x] Admin authentication verified
- [x] Success metrics dashboard integrated
- [ ] CRON_SECRET set in Vercel environment
- [ ] Health check cron verified in production
- [ ] Metrics endpoint tested as admin

---

## Next Steps

1. **Set CRON_SECRET** in Vercel environment variables
2. **Deploy to Vercel** - Cron jobs will run automatically
3. **Verify Health Checks** - Check Vercel dashboard
4. **Test Metrics Endpoint** - Access as admin user
5. **Monitor** - Review cron execution logs

All cron jobs are configured and ready for deployment.
