import { requireSupabaseAdmin } from '@/lib/supabase/server';
import { ERROR_MESSAGES } from '@/config/constants';

export type PendingRatingBooking = {
  id: string;
  booking_id: string;
  salon_id: string;
  salon_name: string;
  service_date: string;
  service_time: string;
};

/**
 * Get the most recent completed booking for a customer that needs rating.
 * Returns null if no pending ratings exist.
 */
export async function getPendingRatingBooking(
  customerUserId: string
): Promise<PendingRatingBooking | null> {
  const supabase = requireSupabaseAdmin();

  const { data: result, error } = await supabase.rpc('get_pending_rating_booking', {
    p_customer_user_id: customerUserId,
  });

  if (error) {
    console.error('[RATING PROMPT] Error fetching pending rating:', error);
    return null;
  }

  const response = result as { success: boolean; booking: PendingRatingBooking | null };
  if (!response?.success) {
    return null;
  }

  return response.booking;
}

/**
 * Mark a booking's rating prompt as ignored.
 * User will never be asked to rate this booking again.
 */
export async function ignoreRatingPrompt(
  bookingId: string,
  customerUserId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = requireSupabaseAdmin();

  const { data: result, error } = await supabase.rpc('create_rating_prompt_ignore', {
    p_booking_id: bookingId,
    p_customer_user_id: customerUserId,
  });

  if (error) {
    console.error('[RATING PROMPT] Error ignoring rating prompt:', error);
    return { success: false, error: ERROR_MESSAGES.DATABASE_ERROR };
  }

  const response = result as { success: boolean; error?: string };
  return { success: response.success, error: response.error };
}
