/**
 * Unit tests: config/quality/local-quality.constants
 * Verifies exit codes and message constants load correctly.
 */

import { describe, it, expect } from 'vitest';
import {
  EXIT_OK,
  EXIT_LINT,
  EXIT_TYPECHECK,
  EXIT_BUILD,
  EXIT_ENV,
  EXIT_FORMAT,
  MSG,
} from '@/config/quality/local-quality.constants';

describe('config/quality/local-quality.constants', () => {
  describe('exit codes', () => {
    it('EXIT_OK is 0', () => {
      expect(EXIT_OK).toBe(0);
    });

    it('EXIT_LINT is 1', () => {
      expect(EXIT_LINT).toBe(1);
    });

    it('EXIT_TYPECHECK is 2', () => {
      expect(EXIT_TYPECHECK).toBe(2);
    });

    it('EXIT_BUILD is 3', () => {
      expect(EXIT_BUILD).toBe(3);
    });

    it('EXIT_ENV is 4', () => {
      expect(EXIT_ENV).toBe(4);
    });

    it('EXIT_FORMAT is 5', () => {
      expect(EXIT_FORMAT).toBe(5);
    });
  });

  describe('MSG constants', () => {
    it('MSG has expected keys and string values', () => {
      expect(MSG.LINT_FAIL).toBe('Lint failed.');
      expect(MSG.TYPECHECK_FAIL).toBe('Type check failed.');
      expect(MSG.BUILD_FAIL).toBe('Build failed.');
      expect(MSG.ENV_FAIL).toBe('Environment validation failed.');
      expect(MSG.FORMAT_FAIL).toBe('Format failed.');
      expect(MSG.GATE_PASS).toBe('Quality gate passed.');
    });

    it('MSG values are non-empty strings', () => {
      const values = Object.values(MSG);
      expect(values.every((v) => typeof v === 'string' && v.length > 0)).toBe(true);
    });
  });
});
