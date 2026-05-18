/**
 * Vitest setup for API route tests.
 * Mocks next-cache (uses React cache()) so it works in Node.
 */
import { vi } from 'vitest';

vi.mock('@/lib/cache/next-cache', () => ({
  setCacheHeaders: vi.fn(),
  setNoCacheHeaders: vi.fn(),
  getCachedBusiness: vi.fn().mockResolvedValue(null),
  getCachedBusinessByLink: vi.fn().mockResolvedValue(null),
}));
