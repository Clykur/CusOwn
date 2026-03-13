/**
 * Worker management module.
 * Provides functions to start and stop all workers.
 */

import { startReminderWorker, stopReminderWorker } from './reminder.worker';
import { startAnalyticsWorker, stopAnalyticsWorker } from './analytics.worker';
import { startNotificationWorker, stopNotificationWorker } from './notification.worker';
import { isQueueAvailable } from '../connection';

/**
 * Start all workers.
 * Call this when the application starts.
 */
export function startAllWorkers(): void {
  if (!isQueueAvailable()) {
    return;
  }

  startReminderWorker();
  startAnalyticsWorker();
  startNotificationWorker();
}

/**
 * Stop all workers gracefully.
 * Call this when the application shuts down.
 */
export async function stopAllWorkers(): Promise<void> {
  await Promise.all([stopReminderWorker(), stopAnalyticsWorker(), stopNotificationWorker()]);
}

export { startReminderWorker, stopReminderWorker } from './reminder.worker';
export { startAnalyticsWorker, stopAnalyticsWorker } from './analytics.worker';
export { startNotificationWorker, stopNotificationWorker } from './notification.worker';
