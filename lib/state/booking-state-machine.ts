import { BOOKING_STATUS } from '@/config/constants';

export type BookingState = typeof BOOKING_STATUS[keyof typeof BOOKING_STATUS];
export type BookingEvent = 'create' | 'confirm' | 'reject' | 'cancel' | 'expire';

export interface BookingStateTransition {
  from: BookingState;
  event: BookingEvent;
  to: BookingState;
  allowed: boolean;
}

const transitions: BookingStateTransition[] = [
  { from: 'pending', event: 'confirm', to: 'confirmed', allowed: true },
  { from: 'pending', event: 'reject', to: 'rejected', allowed: true },
  { from: 'pending', event: 'cancel', to: 'cancelled', allowed: true },
  { from: 'pending', event: 'expire', to: 'cancelled', allowed: true },
  { from: 'confirmed', event: 'cancel', to: 'cancelled', allowed: true },
  { from: 'rejected', event: 'cancel', to: 'cancelled', allowed: false },
  { from: 'cancelled', event: 'cancel', to: 'cancelled', allowed: false },
];

export class BookingStateMachine {
  canTransition(from: BookingState, event: BookingEvent): boolean {
    const transition = transitions.find(t => t.from === from && t.event === event);
    return transition?.allowed || false;
  }

  getNextState(from: BookingState, event: BookingEvent): BookingState | null {
    const transition = transitions.find(t => t.from === from && t.event === event);
    return transition?.allowed ? transition.to : null;
  }

  validateTransition(from: BookingState, to: BookingState, event: BookingEvent): boolean {
    const transition = transitions.find(t => t.from === from && t.event === event);
    return transition?.to === to && transition?.allowed === true;
  }
}

export const bookingStateMachine = new BookingStateMachine();
