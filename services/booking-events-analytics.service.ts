import { requireSupabaseAdmin } from '@/lib/supabase/server';

export type BookingEventType = 'created' | 'cancelled' | 'rescheduled';
export type BookingActorType = 'customer' | 'owner' | 'system';

export interface BookingEventInput {
  bookingId: string;
  eventType: BookingEventType;
  actorType: BookingActorType;
  actorId?: string | null;
  source?: 'api' | 'cron' | 'lazy_heal';
}

class BookingEventsAnalyticsService {
  async recordEvent(input: BookingEventInput): Promise<void> {
    const supabase = requireSupabaseAdmin();
    const { error } = await supabase.from('booking_events').insert({
      booking_id: input.bookingId,
      event_type: input.eventType,
      actor_type: input.actorType,
      actor_id: input.actorId ?? null,
      source: input.source ?? 'api',
    });

    if (error) {
      // Analytics must never break booking flows; log and continue.
      // eslint-disable-next-line no-console
      console.warn('[BOOKING_EVENTS_ANALYTICS] insert failed:', error.message);
    }
  }
}

export const bookingEventsAnalyticsService = new BookingEventsAnalyticsService();
