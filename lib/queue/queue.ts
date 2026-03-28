/**
 * BullMQ job queue implementation for background tasks.
 * Queues: booking-reminders, analytics-events, notification-sending
 *
 * Usage:
 *   await reminderQueue.add('send-reminder', { bookingId, reminderId });
 *   await analyticsQueue.add('record-event', { bookingId, eventType, ... });
 *   await notificationQueue.add('send-notification', { bookingId, type });
 */

import { Queue, Job } from 'bullmq';
import { getQueueConnection, isQueueAvailable } from './connection';

let bullMqConnectionNullLogged = false;

function logBullMqConnectionNullOnce(): void {
  if (bullMqConnectionNullLogged) return;
  bullMqConnectionNullLogged = true;
  console.error(
    '[Queue] BullMQ connection is null despite REDIS_URL being set; check URL format (e.g. redis://:password@host:6379).'
  );
}

function logSkippedEnqueue(
  queueName: string,
  jobName: string,
  details: Record<string, string>
): void {
  const detailStr = Object.entries(details)
    .map(([k, v]) => `${k}=${v}`)
    .join(' ');
  console.warn(
    `[Queue] Skipped enqueue job=${jobName} queue=${queueName} reason=unavailable ${detailStr}`
  );
}

/** Queue names */
export const QUEUE_NAMES = {
  BOOKING_REMINDERS: 'booking-reminders',
  ANALYTICS_EVENTS: 'analytics-events',
  NOTIFICATION_SENDING: 'notification-sending',
} as const;

/** Job types for booking reminders queue */
export type ReminderJobData = {
  bookingId: string;
  reminderId?: string;
  type: 'schedule-reminders' | 'send-reminder' | 'cancel-reminders';
};

/** Job types for analytics events queue */
export type AnalyticsJobData = {
  bookingId: string;
  eventType: 'created' | 'cancelled' | 'rescheduled';
  actorType: 'customer' | 'owner' | 'system';
  actorId?: string | null;
  source?: 'api' | 'cron' | 'lazy_heal';
};

/** Job types for notification sending queue */
export type NotificationJobData = {
  bookingId: string;
  type: 'booking-created' | 'booking-confirmed' | 'booking-rejected' | 'booking-cancelled';
  recipientPhone?: string;
  recipientType: 'customer' | 'owner';
};

/** Default job options */
const DEFAULT_JOB_OPTIONS = {
  attempts: 3,
  backoff: {
    type: 'exponential' as const,
    delay: 1000,
  },
  removeOnComplete: {
    age: 3600, // Keep completed jobs for 1 hour
    count: 1000, // Keep last 1000 completed jobs
  },
  removeOnFail: {
    age: 86400, // Keep failed jobs for 24 hours
  },
};

/** Queue instances (singleton pattern) */
let reminderQueue: Queue<ReminderJobData> | null = null;
let analyticsQueue: Queue<AnalyticsJobData> | null = null;
let notificationQueue: Queue<NotificationJobData> | null = null;

/**
 * Get or create the booking reminders queue.
 */
export function getReminderQueue(): Queue<ReminderJobData> | null {
  if (!isQueueAvailable()) {
    return null;
  }

  if (!reminderQueue) {
    const connection = getQueueConnection();
    if (!connection) {
      logBullMqConnectionNullOnce();
      return null;
    }

    reminderQueue = new Queue<ReminderJobData>(QUEUE_NAMES.BOOKING_REMINDERS, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }

  return reminderQueue;
}

/**
 * Get or create the analytics events queue.
 */
export function getAnalyticsQueue(): Queue<AnalyticsJobData> | null {
  if (!isQueueAvailable()) {
    return null;
  }

  if (!analyticsQueue) {
    const connection = getQueueConnection();
    if (!connection) {
      logBullMqConnectionNullOnce();
      return null;
    }

    analyticsQueue = new Queue<AnalyticsJobData>(QUEUE_NAMES.ANALYTICS_EVENTS, {
      connection,
      defaultJobOptions: {
        ...DEFAULT_JOB_OPTIONS,
        attempts: 2, // Analytics can fail without retry
      },
    });
  }

  return analyticsQueue;
}

/**
 * Get or create the notification sending queue.
 */
export function getNotificationQueue(): Queue<NotificationJobData> | null {
  if (!isQueueAvailable()) {
    return null;
  }

  if (!notificationQueue) {
    const connection = getQueueConnection();
    if (!connection) {
      logBullMqConnectionNullOnce();
      return null;
    }

    notificationQueue = new Queue<NotificationJobData>(QUEUE_NAMES.NOTIFICATION_SENDING, {
      connection,
      defaultJobOptions: DEFAULT_JOB_OPTIONS,
    });
  }

  return notificationQueue;
}

/**
 * Add a job to schedule booking reminders.
 * Falls back to synchronous execution if queue unavailable.
 */
export async function enqueueScheduleReminders(
  bookingId: string
): Promise<Job<ReminderJobData> | null> {
  const queue = getReminderQueue();
  if (!queue) {
    logSkippedEnqueue(QUEUE_NAMES.BOOKING_REMINDERS, 'schedule-reminders', { bookingId });
    return null;
  }

  try {
    const job = await queue.add(
      'schedule-reminders',
      { bookingId, type: 'schedule-reminders' },
      { jobId: `schedule-reminders:${bookingId}` }
    );
    // console.warn: survives Next.js production removeConsole (excludes warn/error)
    console.warn(
      `[Queue] Enqueued schedule-reminders booking_id=${bookingId} bullmq_job_id=${String(job.id)}`
    );
    return job;
  } catch (err) {
    console.error(`[Queue] enqueue schedule-reminders failed booking_id=${bookingId}`, err);
    return null;
  }
}

/**
 * Add a job to send a specific reminder.
 */
export async function enqueueSendReminder(
  bookingId: string,
  reminderId: string
): Promise<Job<ReminderJobData> | null> {
  const queue = getReminderQueue();
  if (!queue) {
    logSkippedEnqueue(QUEUE_NAMES.BOOKING_REMINDERS, 'send-reminder', { bookingId, reminderId });
    return null;
  }

  try {
    const job = await queue.add(
      'send-reminder',
      { bookingId, reminderId, type: 'send-reminder' },
      { jobId: `send-reminder:${reminderId}` }
    );
    console.warn(
      `[Queue] Enqueued send-reminder booking_id=${bookingId} reminder_id=${reminderId} bullmq_job_id=${String(job.id)}`
    );
    return job;
  } catch (err) {
    console.error(
      `[Queue] enqueue send-reminder failed booking_id=${bookingId} reminder_id=${reminderId}`,
      err
    );
    return null;
  }
}

/**
 * Add a job to cancel reminders for a booking.
 */
export async function enqueueCancelReminders(
  bookingId: string
): Promise<Job<ReminderJobData> | null> {
  const queue = getReminderQueue();
  if (!queue) {
    logSkippedEnqueue(QUEUE_NAMES.BOOKING_REMINDERS, 'cancel-reminders', { bookingId });
    return null;
  }

  try {
    const job = await queue.add(
      'cancel-reminders',
      { bookingId, type: 'cancel-reminders' },
      { jobId: `cancel-reminders:${bookingId}:${Date.now()}` }
    );
    console.warn(
      `[Queue] Enqueued cancel-reminders booking_id=${bookingId} bullmq_job_id=${String(job.id)}`
    );
    return job;
  } catch (err) {
    console.error(`[Queue] enqueue cancel-reminders failed booking_id=${bookingId}`, err);
    return null;
  }
}

/**
 * Add a job to record an analytics event.
 * Falls back silently if queue unavailable.
 */
export async function enqueueAnalyticsEvent(
  data: AnalyticsJobData
): Promise<Job<AnalyticsJobData> | null> {
  const queue = getAnalyticsQueue();
  if (!queue) {
    logSkippedEnqueue(QUEUE_NAMES.ANALYTICS_EVENTS, 'record-event', {
      bookingId: data.bookingId,
      eventType: data.eventType,
    });
    return null;
  }

  try {
    const job = await queue.add('record-event', data, {
      jobId: `analytics:${data.bookingId}:${data.eventType}:${Date.now()}`,
    });
    return job;
  } catch (err) {
    console.error(
      `[Queue] enqueue analytics record-event failed booking_id=${data.bookingId} eventType=${data.eventType}`,
      err
    );
    return null;
  }
}

/**
 * Add a job to send a notification.
 */
export async function enqueueNotification(
  data: NotificationJobData
): Promise<Job<NotificationJobData> | null> {
  const queue = getNotificationQueue();
  if (!queue) {
    logSkippedEnqueue(QUEUE_NAMES.NOTIFICATION_SENDING, 'send-notification', {
      bookingId: data.bookingId,
      type: data.type,
    });
    return null;
  }

  try {
    const job = await queue.add('send-notification', data, {
      jobId: `notification:${data.bookingId}:${data.type}:${Date.now()}`,
    });
    console.warn(
      `[Queue] Enqueued notification booking_id=${data.bookingId} type=${data.type} bullmq_job_id=${String(job.id)}`
    );
    return job;
  } catch (err) {
    console.error(
      `[Queue] enqueue notification failed booking_id=${data.bookingId} type=${data.type}`,
      err
    );
    return null;
  }
}

/**
 * Close all queue connections gracefully.
 */
export async function closeQueues(): Promise<void> {
  const closePromises: Promise<void>[] = [];

  if (reminderQueue) {
    closePromises.push(reminderQueue.close());
    reminderQueue = null;
  }

  if (analyticsQueue) {
    closePromises.push(analyticsQueue.close());
    analyticsQueue = null;
  }

  if (notificationQueue) {
    closePromises.push(notificationQueue.close());
    notificationQueue = null;
  }

  await Promise.all(closePromises);
}
