/**
 * Unit tests: lib/uuid
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('uuidv7', function () {
  return {
    uuidv7: function () {
      return '018f1234-5678-7abc-8def-123456789abc';
    },
  };
});

import { generateUuidV7, uuidv7 } from '@/lib/uuid';

describe('uuid', function () {
  it('should_delegate_generateUuidV7_to_uuidv7_package', function () {
    expect(generateUuidV7()).toBe('018f1234-5678-7abc-8def-123456789abc');
    expect(uuidv7()).toBe('018f1234-5678-7abc-8def-123456789abc');
  });
});
