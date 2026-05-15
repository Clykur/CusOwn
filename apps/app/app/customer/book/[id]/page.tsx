import { notFound } from "next/navigation";
import PublicBookingPage from "@/components/booking/public-booking-page";
import {
  salonService,
  businessHoursService,
  downtimeService,
  slotService,
  isValidUUID,
} from "@cusown/shared/server";
import { getISTDateString, getISTNowMinutes, toMinutes } from "@cusown/shared";
import { DEFAULT_CONCURRENT_BOOKING_CAPACITY } from "@cusown/config";
import type { MinuteInterval, Slot } from "@cusown/shared";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string; rebook?: string }>;
}

export const dynamic = "force-dynamic";

export default async function CustomerBookingPage({
  params,
  searchParams,
}: Props) {
  const { id } = await params;
  const { date: queryDate } = await searchParams;

  console.log("Customer route params (id):", id);

  if (!id) {
    notFound();
  }

  const isUUID = isValidUUID(id);
  const business = isUUID
    ? await salonService.getSalonById(id)
    : await salonService.getSalonByBookingLink(id);

  if (!business) {
    notFound();
  }

  const todayStr = queryDate || getISTDateString();

  const [hours, closures, holidays] = await Promise.all([
    businessHoursService.getEffectiveHours(business.id, todayStr),
    downtimeService.getBusinessClosures(business.id).catch(() => []),
    downtimeService.getBusinessHolidays(business.id).catch(() => []),
  ]);

  const closedDates: string[] = [];
  holidays.forEach((h: { holiday_date: string }) =>
    closedDates.push(h.holiday_date),
  );
  closures.forEach((c: { start_date: string; end_date: string }) => {
    const start = new Date(c.start_date);
    const end = new Date(c.end_date);
    const walk = new Date(start);
    while (walk <= end) {
      const y = walk.getFullYear();
      const m = walk.getMonth();
      const day = walk.getDate();
      closedDates.push(
        `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
      );
      walk.setDate(walk.getDate() + 1);
    }
  });

  let initialSlots: Slot[] = [];
  let initialClosedMessage: string | null = null;

  if (!hours || hours.isClosed) {
    const isHoliday = hours && "isHoliday" in hours && hours.isHoliday;
    const holidayName =
      isHoliday && "holidayName" in hours ? hours.holidayName : null;
    if (isHoliday) {
      initialClosedMessage = holidayName
        ? `Holiday today: ${holidayName}. Shop is closed.`
        : "Holiday today. Shop is closed.";
    } else {
      initialClosedMessage = "Shop closed today";
    }
  } else {
    try {
      const nowMinutesIST = getISTNowMinutes();
      const blocked: MinuteInterval[] = [];
      if (hours.break_start_time && hours.break_end_time) {
        blocked.push({
          startMin: toMinutes(hours.break_start_time),
          endMin: toMinutes(hours.break_end_time),
        });
      }

      initialSlots = await slotService.getAvailableSlots(
        business.id,
        todayStr,
        {
          opening_time: hours.opening_time,
          closing_time: hours.closing_time,
          slot_duration: business.slot_duration,
          concurrent_booking_capacity:
            business.concurrent_booking_capacity ??
            DEFAULT_CONCURRENT_BOOKING_CAPACITY,
        },
        {
          skipCleanup: true,
          todayDateStringIST: todayStr,
          nowMinutesIST: nowMinutesIST,
          blockedIntervalsMin: blocked,
        },
      );
    } catch {
      // Non-fatal: client will fetch on mount
    }
  }

  return (
    <PublicBookingPage
      businessSlug={business.booking_link}
      initialBusiness={business}
      initialSlots={initialSlots}
      initialClosedDates={closedDates}
      initialClosedMessage={initialClosedMessage}
      initialDate={todayStr}
    />
  );
}
