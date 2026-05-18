/**
 * Structured JSON logs for observability. No PII in context.
 * Use for lifecycle, metrics, and alerting. Context keys must be safe (ids, counts, codes).
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface StructuredLogContext {
  [key: string]: string | number | boolean | null | undefined;
}

function sanitize(context: StructuredLogContext): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(context)) {
    if (v !== undefined && v !== null) out[k] = v;
  }
  return out;
}

export function logStructured(
  level: LogLevel,
  message: string,
  context: StructuredLogContext = {}
): void {
  const payload = {
    ts: new Date().toISOString(),
    level,
    message,
    ...sanitize(context),
  };
  const line = JSON.stringify(payload);
  if (level === 'error') {
    console.error(line);
  } else {
    console.warn(line);
  }
}
