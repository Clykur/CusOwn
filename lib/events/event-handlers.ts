import { eventBus } from './event-bus';
import {
  BookingCreatedEvent,
  BookingConfirmedEvent,
  BookingRejectedEvent,
  BookingCancelledEvent,
} from './booking-events';
import { SlotReservedEvent, SlotBookedEvent, SlotReleasedEvent } from './slot-events';
import { reminderService } from '@/services/reminder.service';
import { safeMetrics } from '@/lib/monitoring/safe-metrics';

export const setupEventHandlers = (): void => {
  eventBus.on<BookingCreatedEvent>('booking:created', async () => {
    safeMetrics.increment('events.booking.created');
  });

  eventBus.on<BookingConfirmedEvent>('booking:confirmed', async (event) => {
    await reminderService.scheduleBookingReminders(event.booking.id);
    safeMetrics.increment('events.booking.confirmed');
  });

  eventBus.on<BookingRejectedEvent>('booking:rejected', async () => {
    safeMetrics.increment('events.booking.rejected');
  });

  eventBus.on<BookingCancelledEvent>('booking:cancelled', async () => {
    safeMetrics.increment('events.booking.cancelled');
  });

  eventBus.on<SlotReservedEvent>('slot:reserved', async () => {
    safeMetrics.increment('events.slot.reserved');
  });

  eventBus.on<SlotBookedEvent>('slot:booked', async () => {
    safeMetrics.increment('events.slot.booked');
  });

  eventBus.on<SlotReleasedEvent>('slot:released', async () => {
    safeMetrics.increment('events.slot.released');
  });
};
