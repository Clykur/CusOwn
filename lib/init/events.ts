import { setupEventHandlers } from '@/lib/events/event-handlers';
import { startNonceCleanup } from '@/lib/security/nonce-store';

let initialized = false;

export const initializeEvents = (): void => {
  if (initialized) return;
  setupEventHandlers();
  startNonceCleanup();
  initialized = true;
};

if (typeof window === 'undefined') {
  initializeEvents();
}
