/**
 * Queue module exports.
 * Import from '@/lib/queue' for all queue functionality.
 */

export {
  QUEUE_NAMES,
  getReminderQueue,
  getAnalyticsQueue,
  getNotificationQueue,
  enqueueScheduleReminders,
  enqueueSendReminder,
  enqueueCancelReminders,
  enqueueAnalyticsEvent,
  enqueueNotification,
  closeQueues,
} from './queue';

export type { ReminderJobData, AnalyticsJobData, NotificationJobData } from './queue';

export { getQueueConnection, isQueueAvailable } from './connection';

export { startAllWorkers, stopAllWorkers } from './workers';
