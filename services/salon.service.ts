import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { generateSlug, generateUniqueId, formatPhoneNumber } from '@/lib/utils/string';
import { CreateSalonInput, Salon } from '@/types';
import {
  DEFAULT_CONCURRENT_BOOKING_CAPACITY,
  ERROR_MESSAGES,
  MAX_CONCURRENT_BOOKING_CAPACITY,
} from '@/config/constants';
import { downtimeService } from '@/services/downtime.service';
import { dayNameToJsDay } from '@/lib/utils/day-of-week';
import { breakWithinWorkingHours } from '@/lib/utils/business-schedule-validation';
import { validateTimeRange } from '@/lib/utils/validation';
import { normalizeTime, timeToMinutes } from '@/lib/utils/time';
import { logStructured } from '@/lib/observability/structured-log';
import { slotService } from './slot.service';
import { serviceService } from './service.service';
import { cache } from 'react';
import {
  buildQueryCacheKey,
  withQueryCache,
  QUERY_CACHE_TTL,
  QUERY_CACHE_PREFIX,
} from '@/lib/cache/query-cache';

/** PostgREST/Postgres when `concurrent_booking_capacity` column is not migrated yet. */
function isMissingConcurrentBookingCapacityError(
  error: {
    message?: string;
    code?: string;
  } | null
): boolean {
  const m = error?.message ?? '';
  return m.includes('concurrent_booking_capacity') && m.includes('does not exist');
}

const SALON_SELECT_BY_LINK_WITH_CAPACITY =
  'id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, concurrent_booking_capacity, booking_link, address, location, category, qr_code, owner_user_id, created_at, updated_at, city, area, pincode, latitude, longitude, address_line1, address_line2, state, country, postal_code, rating_avg, review_count';

const SALON_SELECT_BY_LINK_NO_CAPACITY =
  'id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, booking_link, address, location, category, qr_code, owner_user_id, created_at, updated_at, city, area, pincode, latitude, longitude, address_line1, address_line2, state, country, postal_code, rating_avg, review_count';

const SALON_SELECT_BY_ID_WITH_CAPACITY =
  'id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, concurrent_booking_capacity, booking_link, address, location, category, qr_code, owner_user_id, created_at, updated_at, rating_avg, review_count, city, area, pincode, latitude, longitude, address_line1, address_line2, state, country, postal_code';

const SALON_SELECT_BY_ID_NO_CAPACITY =
  'id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, booking_link, address, location, category, qr_code, owner_user_id, created_at, updated_at, rating_avg, review_count, city, area, pincode, latitude, longitude, address_line1, address_line2, state, country, postal_code';

const SALON_SELECT_AFTER_CREATE_WITH_CAPACITY =
  'id, salon_name, owner_name, whatsapp_number, opening_time, closing_time, slot_duration, concurrent_booking_capacity, booking_link, address, location, category, qr_code, owner_user_id, created_at, updated_at, city, area, pincode, latitude, longitude, address_line1, address_line2, state, country, postal_code';

export type PostCreateScheduleExtras = {
  weekly_hours?: Array<{ day: string; open: string; close: string; is_closed?: boolean }>;
  breaks?: Array<{ day: string; start: string; end: string }>;
  holidays?: Array<{ date: string; reason?: string }>;
  closures?: Array<{ start_date: string; end_date: string; reason?: string }>;
};

function normalizeTimeSegment(t: string): string {
  const s = t.trim();
  return s.length === 5 ? `${s}:00` : s;
}

export class SalonService {
  /**
   * Seed weekly rows, optional breaks/holidays/closures after business insert.
   */
  async applyPostCreateSchedule(
    businessId: string,
    baseOpen: string,
    baseClose: string,
    extra?: PostCreateScheduleExtras
  ): Promise<void> {
    const bo = normalizeTimeSegment(baseOpen);
    const bc = normalizeTimeSegment(baseClose);
    validateTimeRange(bo, bc);

    if (extra?.weekly_hours && extra.weekly_hours.length > 0) {
      for (const w of extra.weekly_hours) {
        const dow = dayNameToJsDay(w.day);
        if (dow === null) {
          throw new Error('Invalid day name in weekly_hours');
        }
        if (w.is_closed) {
          await downtimeService.upsertSpecialHoursRow(businessId, dow, {
            is_closed: true,
            opening_time: null,
            closing_time: null,
            break_start_time: null,
            break_end_time: null,
          });
        } else {
          const o = normalizeTimeSegment(w.open);
          const c = normalizeTimeSegment(w.close);
          validateTimeRange(o, c);
          await downtimeService.upsertSpecialHoursRow(businessId, dow, {
            opening_time: o,
            closing_time: c,
            is_closed: false,
            break_start_time: null,
            break_end_time: null,
          });
        }
      }
    } else {
      for (let d = 0; d < 7; d++) {
        await downtimeService.upsertSpecialHoursRow(businessId, d, {
          opening_time: bo,
          closing_time: bc,
          is_closed: false,
          break_start_time: null,
          break_end_time: null,
        });
      }
    }

    const existingRows = await downtimeService.getBusinessSpecialHours(businessId);
    const rowByDow = new Map(existingRows.map((r) => [r.day_of_week, r]));

    if (extra?.breaks && extra.breaks.length > 0) {
      const breakDaysSeen = new Set<number>();
      for (const br of extra.breaks) {
        const dow = dayNameToJsDay(br.day);
        if (dow === null) {
          throw new Error('Invalid day name in breaks');
        }
        if (breakDaysSeen.has(dow)) {
          throw new Error('At most one break entry per day');
        }
        breakDaysSeen.add(dow);
        const row = rowByDow.get(dow);
        if (row?.is_closed) {
          throw new Error('Cannot set a break on a closed day');
        }
        const openT = (row?.opening_time as string) || bo;
        const closeT = (row?.closing_time as string) || bc;
        const oMin = timeToMinutes(normalizeTime(openT));
        const cMin = timeToMinutes(normalizeTime(closeT));
        const bs = normalizeTimeSegment(br.start);
        const be = normalizeTimeSegment(br.end);
        const bsMin = timeToMinutes(normalizeTime(bs));
        const beMin = timeToMinutes(normalizeTime(be));
        if (!breakWithinWorkingHours(oMin, cMin, bsMin, beMin)) {
          throw new Error('Break must fall within working hours for that day');
        }
        await downtimeService.upsertSpecialHoursRow(businessId, dow, {
          opening_time: openT,
          closing_time: closeT,
          is_closed: row?.is_closed ?? false,
          break_start_time: bs,
          break_end_time: be,
        });
      }
    }

    if (extra?.holidays) {
      for (const h of extra.holidays) {
        await downtimeService.addHoliday(businessId, h.date, h.reason);
      }
    }
    if (extra?.closures) {
      for (const c of extra.closures) {
        await downtimeService.addClosure(businessId, c.start_date, c.end_date, c.reason);
      }
    }
  }

  async createSalon(data: CreateSalonInput, ownerUserId?: string): Promise<Salon> {
    const { weekly_hours, breaks, holidays, closures, services, ...core } = data;

    const scheduleExtras: PostCreateScheduleExtras | undefined =
      weekly_hours != null ||
      (breaks != null && breaks.length > 0) ||
      (holidays != null && holidays.length > 0) ||
      (closures != null && closures.length > 0)
        ? {
            weekly_hours,
            breaks,
            holidays: holidays?.map((h) => ({ date: h.date, reason: h.reason })),
            closures,
          }
        : undefined;

    const supabaseAdmin = requireSupabaseAdmin();

    let bookingLink = generateSlug(core.salon_name);
    let isUnique = false;
    let attempts = 0;
    const maxAttempts = 10;

    while (!isUnique && attempts < maxAttempts) {
      const { data: existing } = await supabaseAdmin
        .from('businesses')
        .select('id')
        .eq('booking_link', bookingLink)
        .single();

      if (!existing) {
        isUnique = true;
      } else {
        bookingLink = `${generateSlug(core.salon_name)}-${generateUniqueId().toLowerCase()}`;
        attempts++;
      }
    }

    if (!isUnique) {
      throw new Error(ERROR_MESSAGES.BOOKING_LINK_EXISTS);
    }

    // Format phone number with +91 if not already present
    const formattedPhone = formatPhoneNumber(core.whatsapp_number);

    const capacityRaw = core.concurrent_booking_capacity ?? DEFAULT_CONCURRENT_BOOKING_CAPACITY;
    const capacity = Math.min(
      MAX_CONCURRENT_BOOKING_CAPACITY,
      Math.max(1, Math.floor(Number(capacityRaw)))
    );

    const baseInsert = {
      salon_name: core.salon_name,
      owner_name: core.owner_name,
      whatsapp_number: formattedPhone,
      opening_time: core.opening_time,
      closing_time: core.closing_time,
      slot_duration: Number(core.slot_duration),
      booking_link: bookingLink,
      address: core.address,
      location: core.location || null,
      city: core.city ?? null,
      area: core.area ?? null,
      pincode: core.pincode ?? null,
      latitude: core.latitude ?? null,
      longitude: core.longitude ?? null,
      address_line1: core.address_line1 ?? null,
      address_line2: core.address_line2 ?? null,
      state: core.state ?? null,
      country: core.country ?? null,
      postal_code: core.postal_code ?? null,
      owner_user_id: ownerUserId || null,
      category: core.category || 'salon',
    };

    let insertResult = await supabaseAdmin
      .from('businesses')
      .insert({ ...baseInsert, concurrent_booking_capacity: capacity })
      .select(SALON_SELECT_AFTER_CREATE_WITH_CAPACITY)
      .single();

    if (insertResult.error && isMissingConcurrentBookingCapacityError(insertResult.error)) {
      logStructured(
        'warn',
        'concurrent_booking_capacity column missing; apply database/concurrent-booking-capacity.migration.sql',
        {}
      );
      insertResult = await supabaseAdmin
        .from('businesses')
        .insert(baseInsert)
        .select(SALON_SELECT_BY_LINK_NO_CAPACITY)
        .single();
    }

    const { data: salon, error } = insertResult;

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!salon) {
      throw new Error(ERROR_MESSAGES.DATABASE_ERROR);
    }

    // Generate slots immediately when business is created
    // This ensures slots are available right away
    try {
      await slotService.generateInitialSlots(salon.id, {
        opening_time: core.opening_time,
        closing_time: core.closing_time,
        slot_duration: salon.slot_duration,
      });
      logStructured('info', 'Slots generated for new business', {
        business_id: salon.id,
        salon_name: salon.salon_name,
      });
    } catch (slotError) {
      logStructured('warn', 'Initial slot generation failed; slots will be generated lazily', {
        business_id: salon.id,
        error: slotError instanceof Error ? slotError.message : String(slotError),
      });
    }

    try {
      await this.applyPostCreateSchedule(
        salon.id,
        core.opening_time,
        core.closing_time,
        scheduleExtras
      );
    } catch (schedErr) {
      logStructured('warn', 'Post-create schedule seed failed', {
        business_id: salon.id,
        error: schedErr instanceof Error ? schedErr.message : String(schedErr),
      });
    }

    if (services?.length) {
      for (const s of services) {
        await serviceService.createService({
          business_id: salon.id,
          name: s.name.trim(),
          duration_minutes: s.duration_minutes,
          price_cents: s.price_cents,
        });
      }
    }

    // QR code will be generated asynchronously via API route
    // This prevents blocking the salon creation if QR generation is slow

    return salon;
  }

  getSalonByBookingLink = cache(async (bookingLink: string): Promise<Salon | null> => {
    // Build cache key for business by booking link
    const cacheKey = buildQueryCacheKey(`${QUERY_CACHE_PREFIX.BUSINESS}link:`, bookingLink, {});

    return withQueryCache(cacheKey, QUERY_CACHE_TTL.BUSINESS_PROFILE, async () => {
      const supabaseAdmin = requireSupabaseAdmin();
      let row = await supabaseAdmin
        .from('businesses')
        .select(SALON_SELECT_BY_LINK_WITH_CAPACITY)
        .eq('booking_link', bookingLink)
        .eq('suspended', false)
        .is('deleted_at', null)
        .single();

      if (row.error && isMissingConcurrentBookingCapacityError(row.error)) {
        row = await supabaseAdmin
          .from('businesses')
          .select(SALON_SELECT_BY_LINK_NO_CAPACITY)
          .eq('booking_link', bookingLink)
          .eq('suspended', false)
          .is('deleted_at', null)
          .single();
      }

      const { data, error } = row;

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
      }

      return data as unknown as Salon;
    });
  });

  getSalonById = cache(
    async (
      salonId: string,
      includeSuspended = false,
      includeDeleted = false
    ): Promise<Salon | null> => {
      // Build cache key for business by ID
      const cacheKey = buildQueryCacheKey(`${QUERY_CACHE_PREFIX.BUSINESS}id:`, salonId, {
        includeSuspended,
        includeDeleted,
      });

      return withQueryCache(cacheKey, QUERY_CACHE_TTL.BUSINESS_PROFILE, async () => {
        const supabaseAdmin = requireSupabaseAdmin();
        const runSelect = (selectList: string) => {
          let q = supabaseAdmin.from('businesses').select(selectList).eq('id', salonId);
          if (!includeSuspended) {
            q = q.eq('suspended', false);
          }
          if (!includeDeleted) {
            q = q.is('deleted_at', null);
          }
          return q.single();
        };

        let row = await runSelect(SALON_SELECT_BY_ID_WITH_CAPACITY);

        if (row.error && isMissingConcurrentBookingCapacityError(row.error)) {
          row = await runSelect(SALON_SELECT_BY_ID_NO_CAPACITY);
        }

        const { data, error } = row;

        if (error) {
          if (error.code === 'PGRST116') {
            return null;
          }
          throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
        }

        return data as unknown as Salon;
      });
    }
  );
}

export const salonService = new SalonService();
