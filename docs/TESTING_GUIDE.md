# Phase 1 Testing Guide

## Prerequisites

1. ✅ Database migrations run
2. ✅ Environment variables set (including CRON_SECRET)
3. ✅ Application running (`npm run dev`)

---

## Test 1: Customer Booking Visibility

### Steps:

1. Create a booking via `/b/[bookingLink]`
2. Note the booking_id from success page
3. Visit `/booking/[bookingId]`
4. Verify booking details are displayed
5. Check status shows correctly (pending/confirmed/rejected)

### Expected Results:

- ✅ Booking status page loads
- ✅ All booking details visible
- ✅ Status badge shows correct color
- ✅ Business and slot information displayed

---

## Test 2: Customer Cancellation

### Steps:

1. Create a booking and get booking_id
2. Visit `/booking/[bookingId]`
3. Click "Cancel Booking" button
4. Confirm cancellation
5. Refresh page

### Expected Results:

- ✅ Cancellation button visible for pending/confirmed bookings
- ✅ Cancellation confirmation dialog appears
- ✅ Booking status changes to "cancelled"
- ✅ Slot released back to available
- ✅ Cancellation details shown (who cancelled, when, reason)

### Edge Cases:

- Try cancelling already cancelled booking (should fail)
- Try cancelling rejected booking (should fail)
- Try cancelling confirmed booking < 2 hours before (should fail)

---

## Test 3: Owner Cancellation

### Steps:

1. Login as owner
2. Go to `/owner/[bookingLink]`
3. Find a pending or confirmed booking
4. Click "Cancel" button
5. Verify cancellation

### Expected Results:

- ✅ Cancel button visible for owner
- ✅ Booking cancelled successfully
- ✅ Slot released
- ✅ Customer notified (WhatsApp link generated)

---

## Test 4: Business Downtime - Holidays

### Steps:

1. Login as owner
2. Go to `/owner/[bookingLink]`
3. Click "Downtime" tab
4. Add a holiday (date + optional name)
5. Try to book a slot on that date

### Expected Results:

- ✅ Holiday added successfully
- ✅ Holiday appears in list
- ✅ No slots generated for holiday date
- ✅ Booking page shows no slots available

---

## Test 5: Business Downtime - Closures

### Steps:

1. Login as owner
2. Go to `/owner/[bookingLink]`
3. Click "Downtime" tab
4. Add a closure (start date, end date, reason)
5. Try to book slots during closure period

### Expected Results:

- ✅ Closure added successfully
- ✅ Closure appears in list
- ✅ No slots generated during closure period
- ✅ Booking page shows no slots available

---

## Test 6: Reminder System

### Steps:

1. Create a booking and accept it (status = confirmed)
2. Check database: `SELECT * FROM booking_reminders WHERE booking_id = '...'`
3. Verify reminders created (24h before, 2h before)
4. Manually trigger cron: `POST /api/cron/send-reminders`

### Expected Results:

- ✅ Reminders created when booking confirmed
- ✅ Reminders scheduled at correct times
- ✅ Cron job processes pending reminders
- ✅ Reminder status updates to "sent"
- ✅ WhatsApp message sent (check logs)

### Manual Cron Test:

```bash
curl -X POST http://localhost:3000/api/cron/send-reminders \
  -H "Authorization: Bearer YOUR_CRON_SECRET" \
  -H "Content-Type: application/json"
```

---

## Test 7: Customer Dashboard

### Steps:

1. Login as customer (or create booking with user)
2. Visit `/customer/dashboard`
3. Verify bookings list
4. Click "View Details" on a booking

### Expected Results:

- ✅ All customer bookings displayed
- ✅ Booking status visible
- ✅ "View Details" links to status page
- ✅ Empty state shown if no bookings

---

## Test 8: Owner Dashboard - Accept/Reject/Cancel

### Steps:

1. Create a booking (pending status)
2. Login as owner
3. Go to `/owner/[bookingLink]`
4. Find the pending booking
5. Test Accept → Verify status changes, reminder scheduled
6. Test Reject → Verify status changes, slot released
7. Test Cancel → Verify cancellation works

### Expected Results:

- ✅ Accept button works
- ✅ Reject button works
- ✅ Cancel button works
- ✅ Status updates immediately
- ✅ WhatsApp notifications sent

---

## Test 9: Booking Expiry

### Steps:

1. Create a booking (pending)
2. Manually set `created_at` to 25 hours ago in database
3. Run expire cron: `POST /api/cron/expire-bookings`
4. Check booking status

### Expected Results:

- ✅ Pending bookings > 24h old are cancelled
- ✅ Cancelled by = "system"
- ✅ Slot released back to available

### Manual Test:

```bash
curl -X POST http://localhost:3000/api/cron/expire-bookings \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

---

## Test 10: Slot Generation with Downtime

### Steps:

1. Add a holiday for tomorrow
2. Add a closure for next week
3. Visit booking page for those dates
4. Verify no slots generated

### Expected Results:

- ✅ Slots not generated on holidays
- ✅ Slots not generated during closures
- ✅ Normal dates still generate slots

---

## Quick Test Checklist

- [ ] Customer can view booking status page
- [ ] Customer can cancel booking
- [ ] Owner can cancel booking
- [ ] Owner can add holidays
- [ ] Owner can add closures
- [ ] Holidays block slot generation
- [ ] Closures block slot generation
- [ ] Reminders created on booking confirmation
- [ ] Cron job sends reminders
- [ ] Booking expiry works
- [ ] Customer dashboard shows bookings
- [ ] Owner dashboard shows accept/reject/cancel buttons

---

## Common Issues & Fixes

### Issue: Cron job returns 401 Unauthorized

**Fix**: Check CRON_SECRET in `.env.local` matches the Authorization header

### Issue: Reminders not created

**Fix**: Verify booking status is "confirmed" (reminders only for confirmed bookings)

### Issue: Slots still generated on holidays

**Fix**: Check `downtimeService.isBusinessClosed()` is being called in slot generation

### Issue: Cancellation fails

**Fix**: Check booking status allows cancellation (pending/confirmed only)

---

## Database Queries for Verification

```sql
-- Check cancellations
SELECT id, booking_id, status, cancelled_by, cancelled_at, cancellation_reason
FROM bookings
WHERE status = 'cancelled';

-- Check reminders
SELECT id, booking_id, reminder_type, scheduled_at, status, sent_at
FROM booking_reminders
ORDER BY scheduled_at;

-- Check holidays
SELECT id, business_id, holiday_date, holiday_name
FROM business_holidays
ORDER BY holiday_date;

-- Check closures
SELECT id, business_id, start_date, end_date, reason
FROM business_closures
ORDER BY start_date;
```
