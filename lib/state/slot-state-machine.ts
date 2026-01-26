import { SLOT_STATUS } from '@/config/constants';

export type SlotState = typeof SLOT_STATUS[keyof typeof SLOT_STATUS];
export type SlotEvent = 'reserve' | 'book' | 'release' | 'expire';

export interface SlotStateTransition {
  from: SlotState;
  event: SlotEvent;
  to: SlotState;
  allowed: boolean;
}

const transitions: SlotStateTransition[] = [
  { from: 'available', event: 'reserve', to: 'reserved', allowed: true },
  { from: 'reserved', event: 'book', to: 'booked', allowed: true },
  { from: 'reserved', event: 'release', to: 'available', allowed: true },
  { from: 'reserved', event: 'expire', to: 'available', allowed: true },
  { from: 'booked', event: 'release', to: 'available', allowed: true },
];

export class SlotStateMachine {
  canTransition(from: SlotState, event: SlotEvent): boolean {
    const transition = transitions.find(t => t.from === from && t.event === event);
    return transition?.allowed || false;
  }

  getNextState(from: SlotState, event: SlotEvent): SlotState | null {
    const transition = transitions.find(t => t.from === from && t.event === event);
    return transition?.allowed ? transition.to : null;
  }

  validateTransition(from: SlotState, to: SlotState, event: SlotEvent): boolean {
    const transition = transitions.find(t => t.from === from && t.event === event);
    return transition?.to === to && transition?.allowed === true;
  }
}

export const slotStateMachine = new SlotStateMachine();
