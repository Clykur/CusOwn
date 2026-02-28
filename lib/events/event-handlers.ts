import { eventBus } from './event-bus';
import {
  BookingCreatedEvent,
  BookingConfirmedEvent,
  BookingRejectedEvent,
  BookingCancelledEvent,
} from './booking-events';
import { SlotReservedEvent, SlotBookedEvent, SlotReleasedEvent } from './slot-events';
import { reminderService } from '@/services/reminder.service';
import { metricsService } from '@/lib/monitoring/metrics';

export const setupEventHandlers = (): void => {
  eventBus.on<BookingCreatedEvent>('booking:created', async ({ booking }) => {
    await metricsService.increment('events.booking.created');
  });

  eventBus.on<BookingConfirmedEvent>('booking:confirmed', async ({ booking }) => {
    await reminderService.scheduleBookingReminders(booking.id);
    await metricsService.increment('events.booking.confirmed');
  });

  eventBus.on<BookingRejectedEvent>('booking:rejected', async ({ booking }) => {
    await metricsService.increment('events.booking.rejected');
  });

  eventBus.on<BookingCancelledEvent>('booking:cancelled', async ({ booking }) => {
    await metricsService.increment('events.booking.cancelled');
  });

  eventBus.on<SlotReservedEvent>('slot:reserved', async ({ slot }) => {
    await metricsService.increment('events.slot.reserved');
  });

  eventBus.on<SlotBookedEvent>('slot:booked', async ({ slot }) => {
    await metricsService.increment('events.slot.booked');
  });

  eventBus.on<SlotReleasedEvent>('slot:released', async ({ slot }) => {
    await metricsService.increment('events.slot.released');
  });
};
