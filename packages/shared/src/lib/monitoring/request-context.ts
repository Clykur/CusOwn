import { generateUuidV7 } from '../uuid';

type RequestContext = {
  correlationId: string;
};

// Use a conditional import for AsyncLocalStorage to ensure it's only bundled for the server.
// On the client, a mock implementation is used to prevent build errors.
const store =
  process.env.NEXT_RUNTIME === 'nodejs'
    ? new (await import('node:async_hooks')).AsyncLocalStorage<RequestContext>()
    : ({
        run: (_ctx: RequestContext, callback: () => any) => callback(),
        getStore: () => undefined,
      } as unknown as import('node:async_hooks').AsyncLocalStorage<RequestContext>);

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