# Quick Start - Phase 1 Setup

## 1. Update Environment Variable

Update `.env.local` with a secure CRON_SECRET:

```bash
CRON_SECRET=/Djn4+BJe1+OUoZKZ8yU2WSpo+iYkk9B2Jqnw0w9kyA=
```

Or generate your own:

```bash
openssl rand -base64 32
```

## 2. Start Development Server

```bash
# Standard start
npm run dev

# If you encounter webpack/chunk errors, use clean start:
npm run dev:clean
```

**Note:** If you see webpack chunk loading errors (404s, MIME type errors), run `npm run clean:all` first, then restart the dev server. See `TROUBLESHOOTING.md` for details.

## 3. Test Cron Jobs Manually

```bash
# Set the secret
export CRON_SECRET="your-secret-from-env"

# Test reminders
./scripts/test-cron.sh reminders

# Test booking expiry
./scripts/test-cron.sh expire

# Test cleanup
./scripts/test-cron.sh cleanup
```

Or use curl directly:

```bash
curl -X POST http://localhost:3000/api/cron/send-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

## 4. Production Deployment (Vercel)

The `vercel.json` file is already configured. Just deploy:

```bash
vercel deploy
```

Cron jobs will automatically run:

- Reminders: Every 5 minutes
- Booking expiry: Every hour
- Reservation cleanup: Every 10 minutes

## 5. Testing Checklist

Follow `TESTING_GUIDE.md` for complete testing instructions.

Quick test:

1. Create a booking → Check status page works
2. Cancel booking → Verify cancellation
3. Add holiday → Verify slots blocked
4. Accept booking → Verify reminders created
