# Cron Job Setup Guide

## Option 1: Vercel Cron (Recommended for Production)

If deploying on Vercel, add this to `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/cron/send-reminders",
      "schedule": "*/5 * * * *"
    },
    {
      "path": "/api/cron/expire-bookings",
      "schedule": "0 * * * *"
    },
    {
      "path": "/api/cron/cleanup-reservations",
      "schedule": "*/10 * * * *"
    }
  ]
}
```

## Option 2: External Cron Service (EasyCron, cron-job.org, etc.)

1. Sign up for a cron service (e.g., https://cron-job.org)
2. Create a new cron job with these settings:
   - **URL**: `https://your-domain.com/api/cron/send-reminders`
   - **Method**: POST
   - **Headers**: `Authorization: Bearer YOUR_CRON_SECRET`
   - **Schedule**: Every 5 minutes (`*/5 * * * *`)

3. Repeat for other cron jobs:
   - `/api/cron/expire-bookings` - Every hour
   - `/api/cron/cleanup-reservations` - Every 10 minutes

## Option 3: Manual Testing (Development)

For local testing, you can manually trigger:

```bash
curl -X POST http://localhost:3000/api/cron/send-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## Environment Variable

Make sure `.env.local` has:

```
CRON_SECRET=your-random-secret-key-here
```

Generate a secure secret:
```bash
openssl rand -base64 32
```
