/**
 * Repository tests: slot.repository
 * Mocks Supabase; verifies query shape, mapping, errors, edge cases.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import {
  hasSlotsForDate,
  getOccupiedIntervalsForDate,
  getSlotsByIntervals,
  getSlotsByStartEndPairs,
  getSlotById,
  insertSlots,
  releaseExpiredReservationsForBusinessDate,
  releaseExpiredReservationsBatch,
  updateSlotStatus,
  releaseSlotReserved,
  setSlotBooked,
  setSlotReserved,
  type SlotRowInsert,
} from '@/repositories/slot.repository';
import { SLOT_STATUS } from '@/config/constants';

const mockFrom = vi.fn();
const mockRequireSupabaseAdmin = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  requireSupabaseAdmin: () => mockRequireSupabaseAdmin(),
}));

function makeChain(promise: Promise<{ data: unknown; error: unknown }>) {
  const chainable = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lt: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnValue(promise),
    order: vi.fn().mockReturnValue(promise),
    single: vi.fn().mockReturnValue(promise),
    update: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnValue(promise),
    insert: vi.fn().mockReturnValue(promise),
  };
  return chainable;
}

describe('slot.repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSupabaseAdmin.mockReturnValue({ from: mockFrom });
  });

  describe('hasSlotsForDate', () => {
    it('returns true when data has rows', async () => {
      const chain = makeChain(Promise.resolve({ data: [{ id: 's1' }], error: null }));
      mockFrom.mockReturnValueOnce(chain);
      const out = await hasSlotsForDate('b1', '2025-03-15');
      expect(out).toBe(true);
      expect(mockFrom).toHaveBeenCalledWith('slots');
    });

    it('returns false when data is empty', async () => {
      const chain = makeChain(Promise.resolve({ data: [], error: null }));
      mockFrom.mockReturnValueOnce(chain);
      const out = await hasSlotsForDate('b1', '2025-03-15');
      expect(out).toBe(false);
    });

    it('throws when database returns error', async () => {
      const chain = makeChain(
        Promise.resolve({ data: null, error: { message: 'Connection failed' } })
      );
      mockFrom.mockReturnValueOnce(chain);
      await expect(hasSlotsForDate('b1', '2025-03-15')).rejects.toThrow('Connection failed');
    });
  });

  describe('getOccupiedIntervalsForDate', () => {
    it('returns combined booked and reserved intervals', async () => {
      mockFrom
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () =>
                  Promise.resolve({
                    data: [{ start_time: '09:00', end_time: '09:30' }],
                    error: null,
                  }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  gte: () =>
                    Promise.resolve({
                      data: [{ start_time: '10:00', end_time: '10:30' }],
                      error: null,
                    }),
                }),
              }),
            }),
          }),
        });
      const out = await getOccupiedIntervalsForDate('b1', '2025-03-15', '2025-03-15T08:00:00Z');
      expect(out).toHaveLength(2);
      expect(out[0]).toEqual({ start_time: '09:00', end_time: '09:30' });
      expect(out[1]).toEqual({ start_time: '10:00', end_time: '10:30' });
    });

    it('returns empty when no booked or reserved slots', async () => {
      mockFrom
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        })
        .mockReturnValueOnce({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  gte: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }),
        });
      const out = await getOccupiedIntervalsForDate('b1', '2025-03-15', '2025-03-15T08:00:00Z');
      expect(out).toHaveLength(0);
    });
  });

  describe('getSlotsByStartEndPairs', () => {
    it('returns empty array when pairs length is 0', async () => {
      const out = await getSlotsByStartEndPairs('b1', '2025-03-15', []);
      expect(out).toEqual([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('returns slots matching pairs and maps correctly', async () => {
      const rows = [
        {
          id: 'sid1',
          business_id: 'b1',
          date: '2025-03-15',
          start_time: '09:00:00',
          end_time: '09:30:00',
          status: SLOT_STATUS.AVAILABLE,
          reserved_until: null,
          created_at: '2025-03-01T00:00:00Z',
        },
      ];
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () =>
                  Promise.resolve({
                    data: rows,
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      });
      const out = await getSlotsByStartEndPairs('b1', '2025-03-15', [
        { start_time: '09:00', end_time: '09:30' },
      ]);
      expect(out).toHaveLength(1);
      expect(out[0].id).toBe('sid1');
      expect(out[0].start_time).toBe('09:00:00');
      expect(out[0].end_time).toBe('09:30:00');
    });

    it('normalizes HH:MM to HH:MM:00 for matching', async () => {
      const rows = [
        {
          id: 'sid1',
          business_id: 'b1',
          date: '2025-03-15',
          start_time: '10:00:00',
          end_time: '10:30:00',
          status: SLOT_STATUS.AVAILABLE,
          reserved_until: null,
          created_at: '2025-03-01T00:00:00Z',
        },
      ];
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () =>
                  Promise.resolve({
                    data: rows,
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      });
      const out = await getSlotsByStartEndPairs('b1', '2025-03-15', [
        { start_time: '10:00', end_time: '10:30' },
      ]);
      expect(out).toHaveLength(1);
    });

    it('throws when database returns error', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () =>
                  Promise.resolve({
                    data: null,
                    error: { message: 'Query failed' },
                  }),
              }),
            }),
          }),
        }),
      });
      await expect(
        getSlotsByStartEndPairs('b1', '2025-03-15', [{ start_time: '09:00', end_time: '09:30' }])
      ).rejects.toThrow('Query failed');
    });
  });

  describe('getSlotsByIntervals', () => {
    it('calls getSlotsByStartEndPairs with mapped intervals', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                order: () =>
                  Promise.resolve({
                    data: [],
                    error: null,
                  }),
              }),
            }),
          }),
        }),
      });
      const out = await getSlotsByIntervals('b1', '2025-03-15', [{ start: '09:00', end: '09:30' }]);
      expect(out).toEqual([]);
    });
  });

  describe('getSlotById', () => {
    it('returns slot when found', async () => {
      const row = {
        id: 'sid1',
        business_id: 'b1',
        date: '2025-03-15',
        start_time: '09:00:00',
        end_time: '09:30:00',
        status: SLOT_STATUS.AVAILABLE,
        reserved_until: null,
        created_at: '2025-03-01T00:00:00Z',
      };
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                single: () => Promise.resolve({ data: row, error: null }),
              }),
            }),
          }),
        }),
      });
      const out = await getSlotById('sid1', 'b1');
      expect(out).toEqual(row);
    });

    it('returns null when PGRST116 (not found)', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }),
            }),
          }),
        }),
      });
      const out = await getSlotById('nonexistent');
      expect(out).toBeNull();
    });

    it('throws on other errors', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              single: () =>
                Promise.resolve({
                  data: null,
                  error: { message: 'Constraint violation' },
                }),
            }),
          }),
        }),
      });
      await expect(getSlotById('sid1')).rejects.toThrow('Constraint violation');
    });
  });

  describe('insertSlots', () => {
    it('does nothing when rows empty', async () => {
      await insertSlots([]);
      expect(mockFrom).not.toHaveBeenCalled();
    });

    it('calls insert with rows and does not throw on success', async () => {
      const insertMock = vi.fn().mockResolvedValue({ error: null });
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          insert: insertMock,
        }),
      });
      const rows: SlotRowInsert[] = [
        {
          business_id: 'b1',
          date: '2025-03-15',
          start_time: '09:00:00',
          end_time: '09:30:00',
          status: SLOT_STATUS.AVAILABLE,
          reserved_until: null,
        },
      ];
      await insertSlots(rows);
      expect(insertMock).toHaveBeenCalledWith(rows);
    });

    it('throws when insert fails', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          insert: () => Promise.resolve({ error: { message: 'Unique violation' } }),
        }),
      });
      await expect(
        insertSlots([
          {
            business_id: 'b1',
            date: '2025-03-15',
            start_time: '09:00:00',
            end_time: '09:30:00',
            status: SLOT_STATUS.AVAILABLE,
            reserved_until: null,
          },
        ])
      ).rejects.toThrow('Unique violation');
    });
  });

  describe('releaseExpiredReservationsForBusinessDate', () => {
    it('returns 0 when no expired slots', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  lt: () => Promise.resolve({ data: [], error: null }),
                }),
              }),
            }),
          }),
        }),
      });
      const out = await releaseExpiredReservationsForBusinessDate(
        'b1',
        '2025-03-15',
        '2025-03-15T12:00:00Z'
      );
      expect(out).toBe(0);
    });

    it('returns count and triggers update when expired slots exist', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: vi.fn().mockImplementation((table: string) => {
          if (table === 'slots') {
            return {
              select: () => ({
                eq: () => ({
                  eq: () => ({
                    eq: () => ({
                      lt: () =>
                        Promise.resolve({
                          data: [{ id: 's1' }, { id: 's2' }],
                          error: null,
                        }),
                    }),
                  }),
                }),
              }),
              update: () => ({
                in: () => Promise.resolve({ error: null }),
              }),
            };
          }
          return {};
        }),
      });
      const out = await releaseExpiredReservationsForBusinessDate(
        'b1',
        '2025-03-15',
        '2025-03-15T12:00:00Z'
      );
      expect(out).toBe(2);
    });
  });

  describe('updateSlotStatus', () => {
    it('returns true when update affects row', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          update: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: () => Promise.resolve({ data: { id: 'sid1' }, error: null }),
                }),
              }),
            }),
          }),
        }),
      });
      const out = await updateSlotStatus('sid1', 'b1', {
        status: SLOT_STATUS.RESERVED,
        reserved_until: '2025-03-15T10:00:00Z',
      });
      expect(out).toBe(true);
    });

    it('throws when database returns error', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          update: () => ({
            eq: () => ({
              eq: () => ({
                select: () => ({
                  single: () =>
                    Promise.resolve({
                      data: null,
                      error: { message: 'Update failed' },
                    }),
                }),
              }),
            }),
          }),
        }),
      });
      await expect(
        updateSlotStatus('sid1', 'b1', { status: SLOT_STATUS.AVAILABLE })
      ).rejects.toThrow('Update failed');
    });
  });

  describe('releaseSlotReserved', () => {
    it('returns false when PGRST116 (no row updated)', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          update: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });
      const out = await releaseSlotReserved('sid1', 'b1');
      expect(out).toBe(false);
    });

    it('returns true when row updated', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          update: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: () => Promise.resolve({ data: { id: 'sid1' }, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });
      const out = await releaseSlotReserved('sid1', 'b1');
      expect(out).toBe(true);
    });
  });

  describe('setSlotBooked', () => {
    it('returns false when no matching reserved slot', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          update: () => ({
            eq: () => ({
              eq: () => ({
                eq: () => ({
                  select: () => ({
                    single: () => Promise.resolve({ data: null, error: { code: 'PGRST116' } }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });
      const out = await setSlotBooked('sid1', 'b1');
      expect(out).toBe(false);
    });
  });

  describe('setSlotReserved', () => {
    it('returns true when slot updated to reserved', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          update: () => ({
            eq: () => ({
              eq: () => ({
                in: () => ({
                  select: () => ({
                    single: () => Promise.resolve({ data: { id: 'sid1' }, error: null }),
                  }),
                }),
              }),
            }),
          }),
        }),
      });
      const out = await setSlotReserved('sid1', 'b1', '2025-03-15T10:00:00Z');
      expect(out).toBe(true);
    });
  });

  describe('releaseExpiredReservationsBatch', () => {
    it('returns 0 when no expired slots', async () => {
      mockRequireSupabaseAdmin.mockReturnValue({
        from: () => ({
          select: () => ({
            eq: () => ({
              lt: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          }),
        }),
      });
      const out = await releaseExpiredReservationsBatch(10);
      expect(out).toBe(0);
    });
  });
});
