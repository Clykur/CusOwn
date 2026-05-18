/**
 * Vitest setup for service-level tests.
 * Mocks next-cache and react cache so services that use cache() load in Node.
 */
import { vi } from 'vitest';

vi.mock('@/lib/cache/next-cache', () => ({
  setCacheHeaders: vi.fn(),
  setNoCacheHeaders: vi.fn(),
  getCachedBusiness: vi.fn().mockResolvedValue(null),
  getCachedBusinessByLink: vi.fn().mockResolvedValue(null),
}));

vi.mock('react', () => ({
  cache: (fn: unknown) => fn,
}));
