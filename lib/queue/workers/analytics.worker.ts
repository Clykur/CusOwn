/**
 * Worker for processing analytics event jobs.
 * Handles: record-event
 */

import { Worker, Job } from 'bullmq';
import { getQueueConnection, isQueueAvailable } from '../connection';
import { QUEUE_NAMES, AnalyticsJobData } from '../queue';

let analyticsWorker: Worker<AnalyticsJobData> | null = null;

/**
 * Process an analytics job.
 */
async function processAnalyticsJob(job: Job<AnalyticsJobData>): Promise<void> {
  const { bookingId, eventType, actorType, actorId, source } = job.data;

  // Dynamically import to avoid circular dependencies
  const { bookingEventsAnalyticsService } =
    await import('@/services/booking-events-analytics.service');

  await bookingEventsAnalyticsService.recordEvent({
    bookingId,
    eventType,
    actorType,
    actorId,
    source,
  });
}

/**
 * Start the analytics worker.
 */
export function startAnalyticsWorker(): Worker<AnalyticsJobData> | null {
  if (!isQueueAvailable()) {
    return null;
  }

  if (analyticsWorker) {
    return analyticsWorker;
  }

  const connection = getQueueConnection();
  if (!connection) {
    return null;
  }

  analyticsWorker = new Worker<AnalyticsJobData>(
    QUEUE_NAMES.ANALYTICS_EVENTS,
    processAnalyticsJob,
    {
      connection,
      concurrency: 10, // Analytics can be processed in parallel
      limiter: {
        max: 50,
        duration: 1000, // Max 50 jobs per second
      },
    }
  );

  analyticsWorker.on('failed', (job, err) => {
    const { bookingId, eventType } = job?.data ?? {};
    console.error(
      `[Analytics Worker] Job failed bullmq_job_id=${job?.id ?? '?'} booking_id=${bookingId ?? '?'} eventType=${eventType ?? '?'}:`,
      err?.message ?? err
    );
  });

  analyticsWorker.on('error', (err) => {
    console.error('[Analytics Worker] Error:', err);
  });

  return analyticsWorker;
}

/**
 * Stop the analytics worker.
 */
export async function stopAnalyticsWorker(): Promise<void> {
  if (analyticsWorker) {
    await analyticsWorker.close();
    analyticsWorker = null;
  }
}
