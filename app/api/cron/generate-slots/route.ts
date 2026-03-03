/**
 * DEPRECATED: This cron job is no longer needed.
 * Slots are now generated lazily (on-demand) when customers request them.
 *
 * This endpoint is kept for backward compatibility but can be disabled.
 * Consider using /api/cron/cleanup-reservations instead for maintenance.
 */
import { NextRequest } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/server';
import { slotService } from '@/services/slot.service';
import { successResponse, errorResponse } from '@/lib/utils/response';
import {
  ERROR_MESSAGES,
  DAYS_TO_GENERATE_SLOTS,
  METRICS_CRON_LOCK_SKIPPED_TOTAL,
  CRON_SLOT_GENERATION_LOCK_REFRESH_INTERVAL_MS,
} from '@/config/constants';
import { metricsService } from '@/lib/monitoring/metrics';

export async function POST(request: NextRequest) {
  let refreshTimer: ReturnType<typeof setInterval> | null = null;

  try {
    const { validateCronSecret } = await import('@/lib/security/cron-auth');
    const authError = validateCronSecret(request);
    if (authError) return authError;

    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not configured');
    }

    const { data: lockAcquired } = await supabaseAdmin.rpc('try_acquire_slot_generation_lock');
    const acquired =
      lockAcquired === true || (Array.isArray(lockAcquired) && lockAcquired[0] === true);
    if (!acquired) {
      await metricsService.increment(METRICS_CRON_LOCK_SKIPPED_TOTAL);
      return successResponse(null, 'Slot generation skipped: lock held by another instance');
    }

    const { data: businesses, error } = await supabaseAdmin
      .from('businesses')
      .select('id, opening_time, closing_time, slot_duration')
      .is('deleted_at', null);

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!businesses || businesses.length === 0) {
      return successResponse(null, 'No active businesses found');
    }

    // Keep lock alive while running: if generation exceeds lock TTL (10 min), another instance could acquire. Refresh every 2 min.
    refreshTimer = setInterval(() => {
      if (supabaseAdmin) {
        void supabaseAdmin.rpc('refresh_slot_generation_lock').then(
          () => {},
          () => {}
        );
      }
    }, CRON_SLOT_GENERATION_LOCK_REFRESH_INTERVAL_MS);

    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + DAYS_TO_GENERATE_SLOTS);
    const dateString = targetDate.toISOString().split('T')[0];

    let generated = 0;
    const errors: string[] = [];
    for (const biz of businesses) {
      try {
        await slotService.generateSlotsForDate(biz.id, dateString, {
          opening_time: biz.opening_time,
          closing_time: biz.closing_time,
          slot_duration: biz.slot_duration,
        });
        generated++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${biz.id}: ${msg}`);
        console.error('[cron/generate-slots] Failed for business', biz.id, err);
      }
    }

    if (errors.length > 0) {
      return successResponse(
        { generated, total: businesses.length, errors },
        `Slots generated for ${generated}/${businesses.length} businesses; ${errors.length} failed.`
      );
    }
    return successResponse(null, `Slots generated for ${generated} businesses`);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    console.error('[cron/generate-slots] Run failed', message);
    return errorResponse(message, 500);
  } finally {
    if (refreshTimer) clearInterval(refreshTimer);
  }
}
