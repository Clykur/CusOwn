/**
 * Worker for processing booking reminder jobs.
 * Handles: schedule-reminders, send-reminder, cancel-reminders
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, isQueueAvailable } from '../connection';
import { QUEUE_NAMES, ReminderJobData } from '../queue';

let reminderWorker: Worker<ReminderJobData> | null = null;

/**
 * Process a reminder job.
 */
async function processReminderJob(job: Job<ReminderJobData>): Promise<void> {
  const { bookingId, reminderId, type } = job.data;

  // Dynamically import services to avoid circular dependencies
  const { reminderService } = await import('@/services/reminder.service');

  switch (type) {
    case 'schedule-reminders':
      await reminderService.scheduleBookingReminders(bookingId);
      break;

    case 'send-reminder':
      if (!reminderId) {
        throw new Error('reminderId is required for send-reminder job');
      }
      await reminderService.sendReminder(reminderId);
      break;

    case 'cancel-reminders':
      await reminderService.cancelRemindersForBooking(bookingId);
      break;

    default:
      throw new Error(`Unknown reminder job type: ${type}`);
  }
}

/**
 * Start the reminder worker.
 */
export function startReminderWorker(): Worker<ReminderJobData> | null {
  if (!isQueueAvailable()) {
    return null;
  }

  if (reminderWorker) {
    return reminderWorker;
  }

  const connection = getQueueConnection();
  if (!connection) {
    return null;
  }

  reminderWorker = new Worker<ReminderJobData>(QUEUE_NAMES.BOOKING_REMINDERS, processReminderJob, {
    connection,
    concurrency: 5,
    limiter: {
      max: 10,
      duration: 1000, // Max 10 jobs per second
    },
  });

  reminderWorker.on('failed', (job, err) => {
    console.error(`[Reminder Worker] Job ${job?.id} failed:`, err.message);
  });

  reminderWorker.on('error', (err) => {
    console.error('[Reminder Worker] Error:', err);
  });

  return reminderWorker;
}

/**
 * Stop the reminder worker.
 */
export async function stopReminderWorker(): Promise<void> {
  if (reminderWorker) {
    await reminderWorker.close();
    reminderWorker = null;
  }
}
