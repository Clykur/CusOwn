// /lib/time/ist.ts

/** IANA zone for shop calendar and slot keys (India Standard Time). */
export const IST_IANA_TIME_ZONE = 'Asia/Kolkata' as const;

/**
 * Calendar date (YYYY-MM-DD) in IST. Do not use `toISOString().split('T')[0]` — that is UTC and
 * crosses the wrong local day near midnight IST.
 */
export function getISTDateString(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: IST_IANA_TIME_ZONE });
}

/**
 * Current clock time in IST as minutes from midnight [0, 1439].
 * Use for slot cleanup and “today” slot filtering (not server local time / not UTC).
 */
export function getISTNowMinutes(): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: IST_IANA_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return hour * 60 + minute;
}

/**
 * @deprecated Prefer {@link getISTNowMinutes} for time-of-day in IST. Retained for unit tests.
 */
export function getISTDate(): Date {
  return new Date();
}

export function toMinutes(time: string | null | undefined): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
