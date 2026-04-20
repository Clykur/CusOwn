/**
 * Service-level tests: audit.service
 * buildAuditDescription is pure; no mocks. createAuditLog tested with mocked supabase.
 */

import { vi, describe, it, expect } from 'vitest';
import {
  auditService,
  buildAuditDescription,
  type AuditActionType,
} from '@/services/audit.service';

const { mockFrom } = vi.hoisted(() => {
  const auditLogRow = {
    id: 'audit-1',
    action_type: 'booking_confirmed',
    entity_type: 'booking',
    status: 'success',
    severity: 'info',
    created_at: new Date().toISOString(),
  };
  const chain = {
    select: () => chain,
    eq: () => chain,
    gte: () => chain,
    limit: () => chain,
    is: () => chain,
    maybeSingle: () => Promise.resolve({ data: null }),
    insert: () => ({
      select: () => ({
        single: () => Promise.resolve({ data: auditLogRow, error: null }),
      }),
    }),
  };
  return {
    mockFrom: vi.fn(() => chain),
    chain,
    auditLogRow,
  };
});

vi.mock('@/lib/supabase/server', () => ({
  supabaseAdmin: { from: mockFrom },
}));

vi.mock('@/lib/security/audit-pii-redact.security', () => ({
  redactPiiForAudit: (x: unknown) => x,
}));

vi.mock('@/lib/utils/security', () => ({
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

describe('audit.service', () => {
  describe('buildAuditDescription', () => {
    it('returns custom description when provided and non-empty', () => {
      const out = buildAuditDescription(
        'booking_confirmed' as AuditActionType,
        'booking',
        {},
        {},
        '  Custom text  '
      );
      expect(out).toBe('Custom text');
    });

    it('returns empty custom when only whitespace', () => {
      const out = buildAuditDescription(
        'booking_confirmed' as AuditActionType,
        'booking',
        undefined,
        undefined,
        '   '
      );
      expect(out).not.toBe('   ');
      expect(out).toMatch(/Booking|confirmed/);
    });

    it('builds diff when old_data and new_data differ', () => {
      const out = buildAuditDescription(
        'business_updated' as AuditActionType,
        'business',
        { salon_name: 'Old Name' },
        { salon_name: 'New Name' }
      );
      expect(out).toContain('Business name');
      expect(out).toContain('changed from');
      expect(out).toContain('Old Name');
      expect(out).toContain('New Name');
    });

    it('builds "set to" when only new_data has key', () => {
      const out = buildAuditDescription(
        'user_created' as AuditActionType,
        'user',
        {},
        { user_type: 'owner' }
      );
      expect(out).toContain('set to');
      expect(out).toContain('owner');
    });

    it('returns booking fallback when no changes and entity booking', () => {
      const out = buildAuditDescription('booking_confirmed' as AuditActionType, 'booking');
      expect(out).toMatch(/Booking.*confirmed/);
    });

    it('returns business fallback when no changes and entity business', () => {
      const out = buildAuditDescription('business_created' as AuditActionType, 'business');
      expect(out).toMatch(/Business.*created/);
    });

    it('returns user fallback when no changes and entity user', () => {
      const out = buildAuditDescription('admin_access_granted' as AuditActionType, 'user');
      expect(out).toMatch(/User|access|granted/);
    });

    it('handles null and undefined old_data/new_data', () => {
      const out = buildAuditDescription(
        'booking_confirmed' as AuditActionType,
        'booking',
        null,
        undefined
      );
      expect(typeof out).toBe('string');
      expect(out.length).toBeGreaterThan(0);
    });

    it('uses LABEL_KEYS for known keys', () => {
      const out = buildAuditDescription(
        'business_updated' as AuditActionType,
        'business',
        { status: 'pending' },
        { status: 'confirmed' }
      );
      expect(out).toContain('Status');
      expect(out).toContain('pending');
      expect(out).toContain('confirmed');
    });

    it('returns generic action fallback for entity slot when no changes', () => {
      const out = buildAuditDescription('slot_reserved' as AuditActionType, 'slot');
      expect(out).toMatch(/slot_reserved|slot reserved/);
    });

    it('returns generic action fallback for entity payment when no changes', () => {
      const out = buildAuditDescription('payment_completed' as AuditActionType, 'payment');
      expect(out).toMatch(/payment|completed/);
    });

    it('formats number and boolean values in diff', () => {
      const out = buildAuditDescription(
        'business_updated' as AuditActionType,
        'business',
        { slot_duration: 30, active: true },
        { slot_duration: 60, active: false }
      );
      expect(out).toContain('30');
      expect(out).toContain('60');
      expect(out).toContain('true');
      expect(out).toContain('false');
    });

    it('handles removed key when only old_data has value', () => {
      const out = buildAuditDescription(
        'business_updated' as AuditActionType,
        'business',
        { salon_name: 'Old' },
        {}
      );
      expect(out).toBeDefined();
      expect(typeof out).toBe('string');
    });
  });

  describe('createAuditLog', () => {
    it('returns audit log when insert succeeds', async () => {
      const result = await auditService.createAuditLog(
        null,
        'booking_confirmed' as AuditActionType,
        'booking',
        { entityId: 'book-1', description: 'Confirmed' }
      );
      expect(result).not.toBeNull();
      expect(result?.id).toBe('audit-1');
      expect(result?.action_type).toBe('booking_confirmed');
      expect(result?.entity_type).toBe('booking');
      expect(mockFrom).toHaveBeenCalledWith('audit_logs');
    });

    it('returns null when dedupe finds existing log', async () => {
      const chainWithDedupe = {
        select: () => chainWithDedupe,
        eq: () => chainWithDedupe,
        gte: () => chainWithDedupe,
        limit: () => chainWithDedupe,
        is: () => chainWithDedupe,
        maybeSingle: () => Promise.resolve({ data: { id: 'existing' } }),
      };
      mockFrom.mockReturnValueOnce(chainWithDedupe);
      const result = await auditService.createAuditLog(
        null,
        'booking_confirmed' as AuditActionType,
        'booking',
        { entityId: 'book-1' }
      );
      expect(result).toBeNull();
    });

    it('returns null when insert single returns no data', async () => {
      const dedupeChain = {
        select: () => dedupeChain,
        eq: () => dedupeChain,
        gte: () => dedupeChain,
        limit: () => dedupeChain,
        is: () => dedupeChain,
        maybeSingle: () => Promise.resolve({ data: null }),
        insert: () => ({
          select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
        }),
      };
      const insertChain = {
        select: () => insertChain,
        eq: () => insertChain,
        gte: () => insertChain,
        limit: () => insertChain,
        is: () => insertChain,
        maybeSingle: () => Promise.resolve({ data: null }),
        insert: () => ({
          select: () => ({ single: () => Promise.resolve({ data: null, error: null }) }),
        }),
      };
      mockFrom.mockReturnValueOnce(dedupeChain).mockReturnValueOnce(insertChain);
      const result = await auditService.createAuditLog(
        null,
        'booking_confirmed' as AuditActionType,
        'booking',
        { entityId: 'book-1' }
      );
      expect(result).toBeNull();
    });
  });
});
