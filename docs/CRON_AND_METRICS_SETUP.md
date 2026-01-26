# Cron Jobs & Metrics Setup - Complete ✅

## ✅ Cron Jobs Configured

### Health Check Cron (NEW)
- **Endpoint**: `/api/cron/health-check`
- **Schedule**: Every 5 minutes (`*/5 * * * *`)
- **Purpose**: Monitor application health and track uptime
- **Method**: GET or POST
- **Auth**: Bearer token with `CRON_SECRET`
- **Status**: ✅ Configured in `vercel.json`

### Existing Cron Jobs
- ✅ Send Reminders: Every 5 minutes
- ✅ Expire Bookings: Every hour
- ✅ Cleanup Reservations: Every 10 minutes

---

## ✅ Metrics Endpoint

### Success Metrics API
- **Endpoint**: `/api/metrics/success`
- **Access**: Admin only
- **Authentication**: Required (Supabase auth)
- **Authorization**: Admin role check
- **Status**: ✅ Secured and ready

### Access Methods

**1. Via Admin Dashboard:**
- Navigate to Admin Dashboard
- Click "Success Metrics" tab
- View real-time metrics and thresholds

**2. Via API:**
```bash
GET /api/metrics/success?start_date=2026-01-01&end_date=2026-01-25&include_alerts=true
Authorization: Bearer YOUR_AUTH_TOKEN
```

**Query Parameters:**
- `start_date` (optional): Start date for metrics (default: 30 days ago)
- `end_date` (optional): End date for metrics (default: today)
- `include_alerts` (optional): Include alert generation (default: false)

**Response:**
```json
{
  "success": true,
  "data": {
    "metrics": {
      "technical": {
        "apiResponseTimeP95": 150,
        "uptime": 99.95,
        "errorRate": 0.05,
        "dbQueryTimeP95": 80
      },
      "business": {
        "supportQueriesReduction": 60,
        "noShowRate": 8,
        "ownerRetention": 85,
        "bookingCompletionRate": 92
      }
    },
    "thresholds": [
      {
        "metric": "API Response Time (p95)",
        "status": "pass",
        "value": 150,
        "threshold": 200
      },
      ...
    ],
    "alerts": [...]
  }
}
```

---

## Setup Instructions

### 1. Set CRON_SECRET

**Generate Secret:**
```bash
openssl rand -base64 32
```

**Add to `.env.local`:**
```bash
CRON_SECRET=your-generated-secret-here
```

**Add to Vercel:**
1. Go to Vercel Dashboard → Project Settings → Environment Variables
2. Add `CRON_SECRET` with your generated secret
3. Apply to Production, Preview, and Development

### 2. Deploy to Vercel

**Automatic Setup:**
- `vercel.json` already configured
- Deploy: `vercel deploy` or push to main branch
- Cron jobs start automatically

**Verify:**
- Go to Vercel Dashboard → Cron Jobs
- Check all 4 cron jobs are scheduled
- Verify health check runs every 5 minutes

### 3. Test Health Check

**Local Testing:**
```bash
./test-cron.sh health
```

**Or manually:**
```bash
curl -X GET http://localhost:3000/api/cron/health-check \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "checks": {
      "database": "up",
      "timestamp": "2026-01-25T..."
    }
  }
}
```

### 4. Access Metrics Endpoint

**As Admin User:**
1. Log in with admin account
2. Navigate to `/admin/dashboard`
3. Click "Success Metrics" tab
4. View metrics dashboard

**Via API (Admin Token Required):**
```bash
curl http://localhost:3000/api/metrics/success \
  -H "Authorization: Bearer YOUR_ADMIN_AUTH_TOKEN"
```

**Verify Admin Access:**
- Endpoint requires authentication
- Checks admin role via `isAdmin()` function
- Returns 403 if not admin

---

## Verification Checklist

### Cron Jobs
- [x] Health check cron added to `vercel.json`
- [x] Health check endpoint accepts GET and POST
- [x] CRON_SECRET authentication implemented
- [x] Test script updated with health check
- [ ] CRON_SECRET set in Vercel environment
- [ ] Health check cron verified in production
- [ ] All cron jobs running successfully

### Metrics Endpoint
- [x] Endpoint created: `/api/metrics/success`
- [x] Admin authentication required
- [x] Admin authorization check implemented
- [x] Success metrics service integrated
- [x] Alerting service integrated
- [x] Dashboard component created
- [x] Integrated into admin dashboard
- [ ] Tested as admin user
- [ ] Verified metrics calculation
- [ ] Tested alert generation

---

## Monitoring

### Health Check Monitoring
- Runs every 5 minutes
- Results stored in `metric_timings` table
- Metric name: `health.check`
- Uptime calculated from last 24 hours
- Alerts if uptime < 99.9%

### Metrics Monitoring
- Access via admin dashboard
- Real-time metrics display
- Threshold status indicators
- Alert generation (optional)

---

## Troubleshooting

### Health Check Not Running
1. Verify `CRON_SECRET` is set in Vercel
2. Check `vercel.json` configuration
3. Review Vercel cron job logs
4. Verify endpoint URL is correct

### Metrics Endpoint Returns 403
1. Verify user is logged in
2. Check user has admin role
3. Verify `isAdmin()` function works
4. Check authentication token

### Metrics Not Displaying
1. Verify database migration run
2. Check metrics tables exist
3. Verify data in `metrics` and `metric_timings` tables
4. Check date range parameters

---

## Next Steps

1. **Set CRON_SECRET in Vercel**
   - Go to Vercel Dashboard
   - Add environment variable
   - Deploy to activate

2. **Verify Health Checks**
   - Check Vercel cron job logs
   - Verify health check runs every 5 minutes
   - Check metrics are being recorded

3. **Test Metrics Endpoint**
   - Log in as admin
   - Access `/admin/dashboard`
   - Click "Success Metrics" tab
   - Verify metrics display correctly

4. **Monitor**
   - Review cron execution logs
   - Monitor health check results
   - Track metrics trends
   - Set up alerts for thresholds

All cron jobs and metrics endpoints are configured and ready for use.
