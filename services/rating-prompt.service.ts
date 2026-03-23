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

type PendingRatingRpcResponse = {
  success?: boolean;
  booking?: PendingRatingBooking | null;
  bookings?: PendingRatingBooking[] | null;
  data?: {
    booking?: PendingRatingBooking | null;
    bookings?: PendingRatingBooking[] | null;
  } | null;
};

function isPendingRatingBooking(value: unknown): value is PendingRatingBooking {
  if (!value || typeof value !== 'object') return false;

  const booking = value as Record<string, unknown>;

  return (
    typeof booking.id === 'string' &&
    typeof booking.booking_id === 'string' &&
    typeof booking.salon_id === 'string' &&
    typeof booking.salon_name === 'string' &&
    typeof booking.service_date === 'string' &&
    typeof booking.service_time === 'string'
  );
}

function normalizePendingRatingResults(result: unknown): PendingRatingBooking[] {
  if (!result) {
    return [];
  }

  if (Array.isArray(result)) {
    return result.filter(isPendingRatingBooking);
  }

  if (isPendingRatingBooking(result)) {
    return [result];
  }

  if (typeof result !== 'object') {
    return [];
  }

  const rpcResponse = result as PendingRatingRpcResponse;

  if (rpcResponse.success === false) {
    return [];
  }

  if (Array.isArray(rpcResponse.bookings)) {
    return rpcResponse.bookings.filter(isPendingRatingBooking);
  }

  if (Array.isArray(rpcResponse.data?.bookings)) {
    return rpcResponse.data.bookings.filter(isPendingRatingBooking);
  }

  if (rpcResponse.booking && isPendingRatingBooking(rpcResponse.booking)) {
    return [rpcResponse.booking];
  }

  if (rpcResponse.data?.booking && isPendingRatingBooking(rpcResponse.data.booking)) {
    return [rpcResponse.data.booking];
  }

  return [];
}

/**
 * Get all completed bookings for a customer that need rating.
 * Returns empty array if no pending ratings exist.
 */
export async function getPendingRatingBookings(
  customerUserId: string
): Promise<PendingRatingBooking[]> {
  const supabase = requireSupabaseAdmin();

  const { data: result, error } = await supabase.rpc('get_pending_rating_bookings', {
    p_customer_user_id: customerUserId,
  });

  if (error) {
    console.error('[RATING PROMPT] Error fetching pending ratings:', error);
    return [];
  }

  const bookings = normalizePendingRatingResults(result);
  return bookings;
}

/**
 * Backward-compatible single booking helper.
 * Returns the first pending booking or null.
 */
export async function getPendingRatingBooking(
  customerUserId: string
): Promise<PendingRatingBooking | null> {
  const bookings = await getPendingRatingBookings(customerUserId);
  return bookings[0] ?? null;
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
