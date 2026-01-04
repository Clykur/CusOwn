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
import { ERROR_MESSAGES, DAYS_TO_GENERATE_SLOTS } from '@/config/constants';

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET || '';

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return errorResponse('Unauthorized', 401);
    }

    const { data: salons, error } = await supabaseAdmin.from('businesses').select('*');

    if (error) {
      throw new Error(error.message || ERROR_MESSAGES.DATABASE_ERROR);
    }

    if (!salons || salons.length === 0) {
      return successResponse(null, 'No salons found');
    }

    const today = new Date();
    const targetDate = new Date(today);
    targetDate.setDate(today.getDate() + DAYS_TO_GENERATE_SLOTS);
    const dateString = targetDate.toISOString().split('T')[0];

    for (const salon of salons) {
      await slotService.generateSlotsForDate(salon.id, dateString, {
        opening_time: salon.opening_time,
        closing_time: salon.closing_time,
        slot_duration: salon.slot_duration,
      });
    }

    return successResponse(null, `Slots generated for ${salons.length} salons`);
  } catch (error) {
    const message = error instanceof Error ? error.message : ERROR_MESSAGES.DATABASE_ERROR;
    return errorResponse(message, 500);
  }
}

