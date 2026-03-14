import { redirect } from 'next/navigation';
import PublicBookingPage from '@/components/booking/public-booking-page';
import { salonService } from '@/services/salon.service';
import { businessHoursService } from '@/services/business-hours.service';
import { downtimeService } from '@/services/downtime.service';
import { getISTDateString } from '@/lib/time/ist';
import {
  getSlotsByIntervals,
  releaseExpiredReservationsForBusinessDate,
} from '@/repositories/slot.repository';
import { subtractOccupiedFromFullDay } from '@/lib/slot-availability-intervals';
import { SLOT_STATUS } from '@/config/constants';
import type { Slot } from '@/types';

type Props = { params: Promise<{ businessSlug: string }> };

export const dynamic = 'force-dynamic';

/** Customer booking by slug: with sidebar - server-side optimized */
export default async function CustomerBookPage({ params }: Props) {
  const { businessSlug } = await params;
  if (!businessSlug || typeof businessSlug !== 'string') {
    redirect('/');
  }

  // Server-side parallel fetch for instant page load
  const [business, todayStr] = await Promise.all([
    salonService.getSalonByBookingLink(businessSlug),
    Promise.resolve(getISTDateString()),
  ]);

  if (!business) {
    return <PublicBookingPage businessSlug={businessSlug} />;
  }

  // Parallel fetch: hours, downtime, and prepare for slots
  const [hours, closures, holidays] = await Promise.all([
    businessHoursService.getEffectiveHours(business.id, todayStr),
    downtimeService.getBusinessClosures(business.id).catch(() => []),
    downtimeService.getBusinessHolidays(business.id).catch(() => []),
  ]);

  // Pre-compute closed dates for calendar
  const closedDates: string[] = [];
  holidays.forEach((h: { holiday_date: string }) => closedDates.push(h.holiday_date));
  closures.forEach((c: { start_date: string; end_date: string }) => {
    const start = new Date(c.start_date);
    const end = new Date(c.end_date);
    const walk = new Date(start);
    while (walk <= end) {
      const y = walk.getFullYear();
      const m = walk.getMonth();
      const day = walk.getDate();
      closedDates.push(`${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`);
      walk.setDate(walk.getDate() + 1);
    }
  });

  // Fetch initial slots for today (skip if closed)
  let initialSlots: Slot[] = [];
  let initialClosedMessage: string | null = null;

  if (!hours || hours.isClosed) {
    const isHoliday = hours && 'isHoliday' in hours && hours.isHoliday;
    const holidayName = isHoliday && 'holidayName' in hours ? hours.holidayName : null;
    if (isHoliday) {
      initialClosedMessage = holidayName
        ? `Holiday today   ${holidayName}. Shop is closed.`
        : 'Holiday today. Shop is closed.';
    } else {
      initialClosedMessage = 'Shop closed today';
    }
  } else {
    // Fetch slots for today
    try {
      const { getOccupiedIntervalsForDate } = await import('@/repositories/slot.repository');
      const nowIso = new Date().toISOString();
      const [occupied] = await Promise.all([
        getOccupiedIntervalsForDate(business.id, todayStr, nowIso),
        releaseExpiredReservationsForBusinessDate(business.id, todayStr, nowIso),
      ]);
      const fullDay = [{ start: hours.opening_time, end: hours.closing_time }];
      const occupiedIntervals = occupied.map((o) => ({ start: o.start_time, end: o.end_time }));
      const availableIntervals = subtractOccupiedFromFullDay(fullDay, occupiedIntervals);
      const slotRows = await getSlotsByIntervals(business.id, todayStr, availableIntervals);

      const now = new Date();
      const todayDateString = now.toISOString().split('T')[0];
      const isToday = todayStr === todayDateString;

      for (const slot of slotRows) {
        if (isToday) {
          const [h, m] = slot.start_time.split(':').map(Number);
          const slotDateTime = new Date(now);
          slotDateTime.setHours(h, m, 0, 0);
          if (now >= slotDateTime) continue;
        }
        initialSlots.push({
          ...slot,
          status: SLOT_STATUS.AVAILABLE,
          reserved_until: null,
        } as Slot);
      }
    } catch {
      // Non-fatal: client will fetch on mount
    }
  }

  return (
    <PublicBookingPage
      businessSlug={businessSlug}
      initialBusiness={business}
      initialSlots={initialSlots}
      initialClosedDates={closedDates}
      initialClosedMessage={initialClosedMessage}
      initialDate={todayStr}
    />
  );
}
