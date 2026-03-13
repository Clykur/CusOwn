/**
 * Worker for processing notification sending jobs.
 * Handles: send-notification
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, isQueueAvailable } from '../connection';
import { QUEUE_NAMES, NotificationJobData } from '../queue';

let notificationWorker: Worker<NotificationJobData> | null = null;

/**
 * Process a notification job.
 */
async function processNotificationJob(job: Job<NotificationJobData>): Promise<void> {
  const { bookingId, type, recipientType } = job.data;

  // Dynamically import services to avoid circular dependencies
  const { bookingService } = await import('@/services/booking.service');
  const { whatsappService } = await import('@/services/whatsapp.service');

  const booking = await bookingService.getBookingByUuidWithDetails(bookingId);
  if (!booking || !booking.salon) {
    console.warn(`[Notification Worker] Booking ${bookingId} not found or missing salon`);
    return;
  }

  switch (type) {
    case 'booking-created':
      // Generate WhatsApp URL for owner notification
      if (recipientType === 'owner' && booking.slot) {
        whatsappService.generateBookingRequestMessage(booking, booking.salon);
      }
      break;

    case 'booking-confirmed':
      // Generate confirmation WhatsApp URL for customer
      if (recipientType === 'customer' && booking.slot && booking.salon.address) {
        whatsappService.getConfirmationWhatsAppUrl(booking, booking.salon);
      }
      break;

    case 'booking-rejected':
      // Generate rejection WhatsApp URL for customer
      if (recipientType === 'customer' && booking.slot) {
        whatsappService.getRejectionWhatsAppUrl(booking, booking.salon);
      }
      break;

    case 'booking-cancelled':
      // Could send cancellation notification
      break;

    default:
      console.warn(`[Notification Worker] Unknown notification type: ${type}`);
  }
}

/**
 * Start the notification worker.
 */
export function startNotificationWorker(): Worker<NotificationJobData> | null {
  if (!isQueueAvailable()) {
    return null;
  }

  if (notificationWorker) {
    return notificationWorker;
  }

  const connection = getQueueConnection();
  if (!connection) {
    return null;
  }

  notificationWorker = new Worker<NotificationJobData>(
    QUEUE_NAMES.NOTIFICATION_SENDING,
    processNotificationJob,
    {
      connection,
      concurrency: 5,
      limiter: {
        max: 20,
        duration: 1000, // Max 20 notifications per second
      },
    }
  );

  notificationWorker.on('failed', (job, err) => {
    console.error(`[Notification Worker] Job ${job?.id} failed:`, err.message);
  });

  notificationWorker.on('error', (err) => {
    console.error('[Notification Worker] Error:', err);
  });

  return notificationWorker;
}

/**
 * Stop the notification worker.
 */
export async function stopNotificationWorker(): Promise<void> {
  if (notificationWorker) {
    await notificationWorker.close();
    notificationWorker = null;
  }
}
