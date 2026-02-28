import { eventBus } from './event-bus';
import { BookingWithDetails } from '@/types';

export type BookingCreatedEvent = { booking: BookingWithDetails };
export type BookingConfirmedEvent = { booking: BookingWithDetails };
export type BookingRejectedEvent = { booking: BookingWithDetails };
export type BookingCancelledEvent = {
  booking: BookingWithDetails;
  cancelledBy: string;
};

export const emitBookingCreated = async (booking: BookingWithDetails): Promise<void> => {
  await eventBus.emit<BookingCreatedEvent>('booking:created', { booking });
};

export const emitBookingConfirmed = async (booking: BookingWithDetails): Promise<void> => {
  await eventBus.emit<BookingConfirmedEvent>('booking:confirmed', { booking });
};

export const emitBookingRejected = async (booking: BookingWithDetails): Promise<void> => {
  await eventBus.emit<BookingRejectedEvent>('booking:rejected', { booking });
};

export const emitBookingCancelled = async (
  booking: BookingWithDetails,
  cancelledBy: string
): Promise<void> => {
  await eventBus.emit<BookingCancelledEvent>('booking:cancelled', {
    booking,
    cancelledBy,
  });
};
