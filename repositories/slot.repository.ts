/**
 * Slot repository: all slot DB access scoped by business_id (shard-ready, no global scans).
 * Used by slot.service for availability and lifecycle. No raw slot SQL in services.
 */

import { requireSupabaseAdmin } from '@/lib/supabase/server';
import type { Slot } from '@/types';
import { BOOKING_STATUS, SLOT_STATUS } from '@/config/constants';
import { normalizeTime, timeToMinutes } from '@/lib/utils/time';
import type { MinuteInterval } from '@/lib/slot-capacity-timeline';

export type SlotRowInsert = Omit<Slot, 'id' | 'created_at'>;

/** Occupied slot interval (booked or active reserved) for availability computation */
export type OccupiedSlotInterval = { start_time: string; end_time: string };

/**
 * Check if any slot exists for business + date. business_id first.
 */
export async function hasSlotsForDate(businessId: string, date: string): Promise<boolean> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from('slots')
    .select('id')
    .eq('business_id', businessId)
    .eq('date', date)
    .limit(1);
  if (error) throw new Error(error.message);
  return !!(data && data.length > 0);
}

/**
 * Fetch only booked and active reserved slots for business+date (for DSA availability).
 * Expired reserved (reserved_until < nowIso) are excluded   lazy expiry.
 */
export async function getOccupiedIntervalsForDate(
  businessId: string,
  date: string,
  nowIso: string
): Promise<OccupiedSlotInterval[]> {
  const supabase = requireSupabaseAdmin();
  const { data: booked } = await supabase
    .from('slots')
    .select('start_time, end_time')
    .eq('business_id', businessId)
    .eq('date', date)
    .eq('status', SLOT_STATUS.BOOKED);

  const { data: reserved } = await supabase
    .from('slots')
    .select('start_time, end_time')
    .eq('business_id', businessId)
    .eq('date', date)
    .eq('status', SLOT_STATUS.RESERVED)
    .gte('reserved_until', nowIso);

  const intervals: OccupiedSlotInterval[] = [];
  if (booked) intervals.push(...booked);
  if (reserved) intervals.push(...reserved);
  return intervals;
}

/**
 * Occupancy intervals in minutes for capacity-aware availability.
 * Uses slot start + max(booking total_duration, slot length) so multi-service spans block overlapping starts.
 * Booked and active reserved slots only; expired reservations excluded.
 */
export async function getExtendedOccupancyMinuteIntervalsForDate(
  businessId: string,
  date: string,
  nowIso: string
): Promise<MinuteInterval[]> {
  const supabase = requireSupabaseAdmin();
  const { data: slotRows, error } = await supabase
    .from('slots')
    .select('id, start_time, end_time, status, reserved_until')
    .eq('business_id', businessId)
    .eq('date', date)
    .in('status', [SLOT_STATUS.BOOKED, SLOT_STATUS.RESERVED]);

  if (error) {
    throw new Error(error.message);
  }

  const rows = slotRows ?? [];
  if (rows.length === 0) {
    return [];
  }

  const slotIds = rows.map((r: { id: string }) => r.id);
  const { data: bookingRows, error: bookingError } = await supabase
    .from('bookings')
    .select('slot_id, total_duration_minutes, status')
    .in('slot_id', slotIds);

  if (bookingError) {
    throw new Error(bookingError.message);
  }

  const bookingBySlot = new Map<
    string,
    { total_duration_minutes: number | null; status: string }
  >();
  for (const b of bookingRows ?? []) {
    const row = b as { slot_id: string; total_duration_minutes: number | null; status: string };
    if (!bookingBySlot.has(row.slot_id)) {
      bookingBySlot.set(row.slot_id, row);
    }
  }

  const out: MinuteInterval[] = [];

  for (const row of rows as Array<{
    id: string;
    start_time: string;
    end_time: string;
    status: string;
    reserved_until: string | null;
  }>) {
    if (row.status === SLOT_STATUS.RESERVED) {
      if (!row.reserved_until || row.reserved_until < nowIso) {
        continue;
      }
    }

    const startMin = timeToMinutes(normalizeTime(row.start_time));
    const endMinSlot = timeToMinutes(normalizeTime(row.end_time));
    const slotLen = Math.max(0, endMinSlot - startMin);

    const b = bookingBySlot.get(row.id);
    if (b?.status === BOOKING_STATUS.CANCELLED || b?.status === BOOKING_STATUS.REJECTED) {
      continue;
    }

    const total = b?.total_duration_minutes;
    const dur =
      total != null && Number.isFinite(total) && total > 0 ? Math.max(total, slotLen) : slotLen;

    if (dur <= 0) {
      continue;
    }

    out.push({ startMin, endMin: startMin + dur });
  }

  return out;
}

/**
 * Fetch slot rows for given business+date and (start, end) interval pairs.
 * Uses getSlotsByStartEndPairs (single query + in-memory filter) to avoid URL length limits.
 */
export async function getSlotsByIntervals(
  businessId: string,
  date: string,
  intervals: Array<{ start: string; end: string }>
): Promise<Slot[]> {
  const pairs = intervals.map((i) => ({ start_time: i.start, end_time: i.end }));
  return getSlotsByStartEndPairs(businessId, date, pairs);
}

/**
 * Fetch slot rows by exact (start_time, end_time) list. Used when interval count is small.
 * Supabase .or() with many pairs can be large; we do a single query with .in() on a
 * composite if needed. For simplicity we query by (business_id, date) and filter in memory
 * when intervals length is large to avoid URL length limits.
 */
export async function getSlotsByStartEndPairs(
  businessId: string,
  date: string,
  pairs: Array<{ start_time: string; end_time: string }>
): Promise<Slot[]> {
  if (pairs.length === 0) return [];
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from('slots')
    .select('id, business_id, date, start_time, end_time, status, reserved_until, created_at')
    .eq('business_id', businessId)
    .eq('date', date)
    .order('start_time', { ascending: true });

  if (error) throw new Error(error.message);
  const normalize = (t: string) => (t.length === 5 ? `${t}:00` : t);
  const set = new Set(pairs.map((p) => `${normalize(p.start_time)}\t${normalize(p.end_time)}`));
  return ((data ?? []) as Slot[]).filter((s) =>
    set.has(`${normalize(s.start_time)}\t${normalize(s.end_time)}`)
  );
}

/**
 * Get single slot by id; optional business_id for strict isolation.
 */
export async function getSlotById(slotId: string, businessId?: string): Promise<Slot | null> {
  const supabase = requireSupabaseAdmin();
  let q = supabase
    .from('slots')
    .select('id, business_id, date, start_time, end_time, status, reserved_until, created_at')
    .eq('id', slotId);
  if (businessId) q = q.eq('business_id', businessId);
  const { data, error } = await q.single();
  if (error) {
    if (error.code === 'PGRST116') return null;
    throw new Error(error.message);
  }
  return data as Slot;
}

/**
 * Insert slot rows for one business+date. business_id is on every row.
 */
export async function insertSlots(rows: SlotRowInsert[]): Promise<void> {
  if (rows.length === 0) return;
  const supabase = requireSupabaseAdmin();
  const { error } = await supabase.from('slots').insert(rows);
  if (error) throw new Error(error.message);
}

/**
 * Amortized cleanup: set status=available for expired reserved in a given business+date.
 * Returns count updated. Scoped to business+date (no global scan).
 */
export async function releaseExpiredReservationsForBusinessDate(
  businessId: string,
  date: string,
  nowIso: string
): Promise<number> {
  const supabase = requireSupabaseAdmin();
  const { data: ids, error: selectError } = await supabase
    .from('slots')
    .select('id')
    .eq('business_id', businessId)
    .eq('date', date)
    .eq('status', SLOT_STATUS.RESERVED)
    .lt('reserved_until', nowIso);
  if (selectError) throw new Error(selectError.message);
  if (!ids?.length) return 0;
  const { error: updateError } = await supabase
    .from('slots')
    .update({ status: SLOT_STATUS.AVAILABLE, reserved_until: null })
    .in(
      'id',
      ids.map((r) => r.id)
    );
  if (updateError) throw new Error(updateError.message);
  return ids.length;
}

/**
 * Batch release expired reservations (for cron). Uses partial index; limit to avoid long runs.
 */
export async function releaseExpiredReservationsBatch(limit: number): Promise<number> {
  const supabase = requireSupabaseAdmin();
  const { data: ids, error: selectError } = await supabase
    .from('slots')
    .select('id')
    .eq('status', SLOT_STATUS.RESERVED)
    .lt('reserved_until', new Date().toISOString())
    .limit(limit);
  if (selectError) throw new Error(selectError.message);
  if (!ids?.length) return 0;
  const { error: updateError } = await supabase
    .from('slots')
    .update({ status: SLOT_STATUS.AVAILABLE, reserved_until: null })
    .in(
      'id',
      ids.map((r) => r.id)
    );
  if (updateError) throw new Error(updateError.message);
  return ids.length;
}

/**
 * Update slot status (and optional reserved_until). business_id required for isolation.
 */
export async function updateSlotStatus(
  slotId: string,
  businessId: string,
  updates: { status: string; reserved_until?: string | null }
): Promise<boolean> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from('slots')
    .update(updates)
    .eq('id', slotId)
    .eq('business_id', businessId)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return !!data;
}

/**
 * Release slot (reserved -> available). Only updates if status is reserved.
 */
export async function releaseSlotReserved(slotId: string, businessId: string): Promise<boolean> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from('slots')
    .update({ status: SLOT_STATUS.AVAILABLE, reserved_until: null })
    .eq('id', slotId)
    .eq('business_id', businessId)
    .eq('status', SLOT_STATUS.RESERVED)
    .select('id')
    .single();
  if (error) {
    if (error.code === 'PGRST116') return false;
    throw new Error(error.message);
  }
  return !!data;
}

/**
 * Book slot (reserved -> booked). Only updates if status is reserved.
 */
export async function setSlotBooked(slotId: string, businessId: string): Promise<boolean> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from('slots')
    .update({ status: SLOT_STATUS.BOOKED, reserved_until: null })
    .eq('id', slotId)
    .eq('business_id', businessId)
    .eq('status', SLOT_STATUS.RESERVED)
    .select('id')
    .single();
  if (error) {
    if (error.code === 'PGRST116') return false;
    throw new Error(error.message);
  }
  return !!data;
}

/**
 * Set slot to reserved if currently available or reserved (expiry checked by caller).
 * Returns true if row was updated.
 */
export async function setSlotReserved(
  slotId: string,
  businessId: string,
  reservedUntilIso: string
): Promise<boolean> {
  const supabase = requireSupabaseAdmin();
  const { data, error } = await supabase
    .from('slots')
    .update({ status: SLOT_STATUS.RESERVED, reserved_until: reservedUntilIso })
    .eq('id', slotId)
    .eq('business_id', businessId)
    .in('status', [SLOT_STATUS.AVAILABLE, SLOT_STATUS.RESERVED])
    .select('id')
    .single();
  if (error) {
    if (error.code === 'PGRST116') return false;
    throw new Error(error.message);
  }
  return !!data;
}
