import { eventBus } from './event-bus';
import { Slot } from '@/types';

export type SlotReservedEvent = { slot: Slot };
export type SlotBookedEvent = { slot: Slot };
export type SlotReleasedEvent = { slot: Slot };

export const emitSlotReserved = async (slot: Slot): Promise<void> => {
  await eventBus.emit<SlotReservedEvent>('slot:reserved', { slot });
};

export const emitSlotBooked = async (slot: Slot): Promise<void> => {
  await eventBus.emit<SlotBookedEvent>('slot:booked', { slot });
};

export const emitSlotReleased = async (slot: Slot): Promise<void> => {
  await eventBus.emit<SlotReleasedEvent>('slot:released', { slot });
};
