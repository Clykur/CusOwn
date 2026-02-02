import { PaymentStatus } from '@/services/payment.service';

export type PaymentEvent = 'initiate' | 'verify' | 'fail' | 'expire' | 'refund';

export interface PaymentStateTransition {
  from: PaymentStatus;
  event: PaymentEvent;
  to: PaymentStatus;
  allowed: boolean;
}

const transitions: PaymentStateTransition[] = [
  { from: 'failed', event: 'verify', to: 'failed', allowed: false },
  { from: 'initiated', event: 'verify', to: 'completed', allowed: true },
  { from: 'initiated', event: 'fail', to: 'failed', allowed: true },
  { from: 'initiated', event: 'expire', to: 'expired', allowed: true },
  { from: 'pending', event: 'verify', to: 'completed', allowed: true },
  { from: 'pending', event: 'fail', to: 'failed', allowed: true },
  { from: 'processing', event: 'verify', to: 'completed', allowed: true },
  { from: 'processing', event: 'fail', to: 'failed', allowed: true },
  { from: 'completed', event: 'refund', to: 'refunded', allowed: true },
  { from: 'completed', event: 'refund', to: 'partially_refunded', allowed: true },
];

export class PaymentStateMachine {
  canTransition(from: PaymentStatus, event: PaymentEvent): boolean {
    const transition = transitions.find((t) => t.from === from && t.event === event);
    return transition?.allowed || false;
  }

  getNextState(from: PaymentStatus, event: PaymentEvent): PaymentStatus | null {
    const transition = transitions.find((t) => t.from === from && t.event === event);
    return transition?.allowed ? transition.to : null;
  }

  validateTransition(from: PaymentStatus, to: PaymentStatus, event: PaymentEvent): boolean {
    const transition = transitions.find((t) => t.from === from && t.event === event);
    return transition?.to === to && transition?.allowed === true;
  }
}

export const paymentStateMachine = new PaymentStateMachine();
