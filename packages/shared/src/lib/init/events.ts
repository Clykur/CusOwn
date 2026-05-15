import { setupEventHandlers } from "../events/event-handlers";
import { startNonceCleanup } from "../security/nonce-store";

let initialized = false;

export const initializeEvents = (): void => {
  if (initialized) return;
  setupEventHandlers();
  startNonceCleanup();
  initialized = true;
};

if (typeof window === "undefined") {
  initializeEvents();
}
