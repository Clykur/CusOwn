import { getCorrelationId } from './request-context';

type LogLevel = 'info' | 'warn' | 'error';

function log(level: LogLevel, message: string, extra?: Record<string, unknown>): void {
  const correlationId = getCorrelationId();
  // _payload unused
  console.warn(
    JSON.stringify(
      {
        level,
        msg: message,
        correlation_id: correlationId,
        ...extra,
        timestamp: new Date().toISOString(),
      },
      null,
      2
    )
  );
  // Structured JSON for log aggregators; keep out of core business logic.
  // eslint-disable-next-line no-console
}

export const requestLogger = {
  info: (message: string, extra?: Record<string, unknown>) => log('info', message, extra),
  warn: (message: string, extra?: Record<string, unknown>) => log('warn', message, extra),
  error: (message: string, extra?: Record<string, unknown>) => log('error', message, extra),
};
