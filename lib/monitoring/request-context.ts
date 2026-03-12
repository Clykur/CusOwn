import { AsyncLocalStorage } from 'node:async_hooks';
import { generateUuidV7 } from '@/lib/uuid';

type RequestContext = {
  correlationId: string;
};

const store = new AsyncLocalStorage<RequestContext>();

export function withRequestContext<T>(
  req: Request,
  handler: (ctx: RequestContext) => Promise<T>
): Promise<T> {
  const incoming = req.headers.get('x-correlation-id');
  const correlationId = incoming && incoming.trim().length > 0 ? incoming.trim() : generateUuidV7();

  return store.run({ correlationId }, () => handler({ correlationId }));
}

export function getCorrelationId(): string | undefined {
  return store.getStore()?.correlationId;
}
