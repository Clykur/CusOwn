// /lib/time/ist.ts

export function getISTDate(): Date {
  const now = new Date();
  const istOffsetMinutes = 5.5 * 60;
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + istOffsetMinutes * 60000);
}

export function getISTDateString(): string {
  return getISTDate().toISOString().split('T')[0];
}

export function toMinutes(time: string | null | undefined): number {
  if (!time) return 0;
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
