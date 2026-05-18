import { generateUuidV7 } from '../uuid';

type RequestContext = {
  correlationId: string;
};

type ALS = import('node:async_hooks').AsyncLocalStorage<RequestContext>;

function createBrowserMock(): ALS {
  return {
    run: (_ctx: RequestContext, callback: () => unknown) => callback(),
    getStore: () => undefined,
  } as unknown as ALS;
}

let store: ALS | null = null;

function shouldUseNodeAsyncLocalStorage(): boolean {
  if (typeof process === 'undefined') return false;
  if (process.env.NEXT_RUNTIME === 'edge') return false;
  if (process.env.NEXT_RUNTIME === 'nodejs') return true;
  // Vitest/tsx/Node without Next: real Node has process.versions.node.
  return typeof process.versions?.node === 'string' && process.versions.node.length > 0;
}

function getStore(): ALS {
  if (store) return store;
  if (shouldUseNodeAsyncLocalStorage()) {
    // Deferred require keeps async_hooks out of client bundles; avoids top-level await (tsx CJS).
    const { AsyncLocalStorage } = require('node:async_hooks') as typeof import('node:async_hooks');
    store = new AsyncLocalStorage<RequestContext>();
    return store;
  }
  store = createBrowserMock();
  return store;
}

export function withRequestContext<T>(
  req: Request,
  handler: (ctx: RequestContext) => Promise<T>
): Promise<T> {
  const incoming = req.headers.get('x-correlation-id');
  const correlationId = incoming && incoming.trim().length > 0 ? incoming.trim() : generateUuidV7();

  return getStore().run({ correlationId }, () => handler({ correlationId }));
}

export function getCorrelationId(): string | undefined {
  return getStore().getStore()?.correlationId;
}
