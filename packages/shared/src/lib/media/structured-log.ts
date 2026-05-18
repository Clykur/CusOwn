/**
 * Structured (JSON) logs for media subsystem. Compatible with distributed tracing.
 * Add trace_id/span_id from request headers when available.
 */

export type MediaLogEvent =
  | 'media.upload.start'
  | 'media.upload.success'
  | 'media.upload.failure'
  | 'media.signed_url.generated'
  | 'media.delete'
  | 'media.purge.cron'
  | 'media.security.reject';

export interface MediaStructuredLogPayload {
  event: MediaLogEvent;
  duration_ms?: number;
  media_id?: string;
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  error?: string;
  trace_id?: string;
  span_id?: string;
  [key: string]: unknown;
}

export function logMediaStructured(payload: MediaStructuredLogPayload): void {
  const line = JSON.stringify({
    ...payload,
    timestamp: new Date().toISOString(),
    service: 'media',
  });
  // Use console.warn for all structured lines (console.log is disallowed by repo policy).
  console.warn(line);
}
