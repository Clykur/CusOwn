/**
 * Unit tests: config/feature-flags
 * Verifies feature flag exports and isFeatureEnabled behavior.
 * Mocks config/env so flag values are deterministic.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';

const mockFlags = {
  paymentCanary: true,
  reschedule: true,
  noShow: true,
};

vi.mock('@/config/env', () => ({
  env: {
    featureFlags: mockFlags,
  },
}));

describe('config/feature-flags', () => {
  beforeEach(() => {
    mockFlags.paymentCanary = true;
    mockFlags.reschedule = true;
    mockFlags.noShow = true;
    vi.resetModules();
  });

  describe('feature flags load from env', () => {
    it('exports paymentCanary true when env flag is true', async () => {
      mockFlags.paymentCanary = true;
      const { FEATURE_PAYMENT_CANARY } = await import('@/config/feature-flags');
      expect(FEATURE_PAYMENT_CANARY).toBe(true);
    });

    it('exports paymentCanary false when env flag is false', async () => {
      mockFlags.paymentCanary = false;
      const { FEATURE_PAYMENT_CANARY } = await import('@/config/feature-flags');
      expect(FEATURE_PAYMENT_CANARY).toBe(false);
    });

    it('exports reschedule and noShow from env', async () => {
      mockFlags.reschedule = false;
      mockFlags.noShow = false;
      const { FEATURE_RESCHEDULE, FEATURE_NO_SHOW } = await import('@/config/feature-flags');
      expect(FEATURE_RESCHEDULE).toBe(false);
      expect(FEATURE_NO_SHOW).toBe(false);
    });
  });

  describe('isFeatureEnabled', () => {
    it('returns true for payment_canary when flag is enabled', async () => {
      mockFlags.paymentCanary = true;
      const { isFeatureEnabled } = await import('@/config/feature-flags');
      expect(isFeatureEnabled('payment_canary')).toBe(true);
    });

    it('returns false for payment_canary when flag is disabled', async () => {
      mockFlags.paymentCanary = false;
      const { isFeatureEnabled } = await import('@/config/feature-flags');
      expect(isFeatureEnabled('payment_canary')).toBe(false);
    });

    it('returns correct value for reschedule', async () => {
      mockFlags.reschedule = true;
      const { isFeatureEnabled } = await import('@/config/feature-flags');
      expect(isFeatureEnabled('reschedule')).toBe(true);
      vi.resetModules();
      mockFlags.reschedule = false;
      const { isFeatureEnabled: isFeatureEnabled2 } = await import('@/config/feature-flags');
      expect(isFeatureEnabled2('reschedule')).toBe(false);
    });

    it('returns correct value for no_show', async () => {
      mockFlags.noShow = false;
      const { isFeatureEnabled } = await import('@/config/feature-flags');
      expect(isFeatureEnabled('no_show')).toBe(false);
    });

    it('returns correct value for each known flag', async () => {
      mockFlags.paymentCanary = true;
      mockFlags.reschedule = true;
      mockFlags.noShow = true;
      const { isFeatureEnabled } = await import('@/config/feature-flags');
      expect(isFeatureEnabled('payment_canary')).toBe(true);
      expect(isFeatureEnabled('reschedule')).toBe(true);
      expect(isFeatureEnabled('no_show')).toBe(true);
    });
  });
});
