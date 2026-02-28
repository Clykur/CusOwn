# URL Configuration Guide

## Environment Variables

### Development (.env.local)

```bash
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Production (.env.production or Vercel)

```bash
NEXT_PUBLIC_APP_URL=https://cusown.clykur.com
```

## How It Works

The system automatically detects the environment and uses the correct URLs:

### Server-Side (API Routes)

- Uses `getBaseUrl(request)` which checks:
  1. Request origin (from NextRequest)
  2. `NEXT_PUBLIC_APP_URL` environment variable
  3. `VERCEL_URL` (auto-set by Vercel)
  4. Falls back to production domain or localhost

### Client-Side (React Components)

- Uses `getClientBaseUrl()` which checks:
  1. `window.location.origin` (current page URL)
  2. `NEXT_PUBLIC_APP_URL` environment variable
  3. Falls back appropriately

## URL Generation Functions

All URLs are generated using centralized functions:

```typescript
// Booking page URL
getBookingUrl(bookingLink, request);
// → https://cusown.clykur.com/b/booking-link (prod)
// → http://localhost:3000/b/booking-link (dev)

// Booking status URL
getBookingStatusUrl(bookingId, request);
// → https://cusown.clykur.com/booking/ABC123 (prod)
// → http://localhost:3000/booking/ABC123 (dev)

// Base URL
getBaseUrl(request);
// → https://cusown.clykur.com (prod)
// → http://localhost:3000 (dev)
```

## Testing

### Local Development

1. Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env.local`
2. All URLs will use `http://localhost:3000`

### Production

1. Set `NEXT_PUBLIC_APP_URL=https://cusown.clykur.com` in Vercel environment variables
2. All URLs will use `https://cusown.clykur.com`

### Vercel Preview Deployments

- Automatically uses `VERCEL_URL` if set
- Falls back to `NEXT_PUBLIC_APP_URL` if configured

## Important Notes

- ✅ All booking links work in both dev and prod
- ✅ WhatsApp messages contain correct URLs
- ✅ OAuth callbacks use correct redirect URLs
- ✅ Booking status pages accessible via correct URLs
- ✅ QR codes contain correct booking URLs

## Troubleshooting

### Issue: URLs pointing to localhost in production

**Fix**: Set `NEXT_PUBLIC_APP_URL` in Vercel environment variables

### Issue: URLs pointing to production in development

**Fix**: Set `NEXT_PUBLIC_APP_URL=http://localhost:3000` in `.env.local`

### Issue: OAuth redirects failing

**Fix**: Ensure Supabase redirect URLs include both localhost and production domain
