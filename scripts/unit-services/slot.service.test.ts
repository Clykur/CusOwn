/**
 * Service-level tests: slot.service
 * getSlotById and reserveSlot with mocked repository and dependencies.
 */

import { vi, describe, it, expect, beforeEach } from 'vitest';
import { slotService } from '@/services/slot.service';
import { SLOT_STATUS } from '@/config/constants';

const mockGetSlotById = vi.fn();
const mockUpdateSlotStatus = vi.fn();
const mockSetSlotReserved = vi.fn();
const mockCreateAuditLog = vi.fn().mockResolvedValue(null);

vi.mock('@/repositories/slot.repository', () => ({
  getSlotById: (...args: unknown[]) => mockGetSlotById(...args),
  updateSlotStatus: (...args: unknown[]) => mockUpdateSlotStatus(...args),
  setSlotReserved: (...args: unknown[]) => mockSetSlotReserved(...args),
  hasSlotsForDate: vi.fn().mockResolvedValue(false),
  getExtendedOccupancyMinuteIntervalsForDate: vi.fn().mockResolvedValue([]),
  getSlotsByIntervals: vi.fn().mockResolvedValue([]),
  insertSlots: vi.fn().mockResolvedValue(undefined),
  releaseExpiredReservationsForBusinessDate: vi.fn().mockResolvedValue(0),
  releaseExpiredReservationsBatch: vi.fn().mockResolvedValue(0),
  releaseSlotReserved: vi.fn().mockResolvedValue(true),
  setSlotBooked: vi.fn().mockResolvedValue(true),
}));

vi.mock('@/services/audit.service', () => ({
  auditService: {
    createAuditLog: (...args: unknown[]) => mockCreateAuditLog(...args),
  },
}));

vi.mock('@/lib/events/slot-events', () => ({
  emitSlotReserved: vi.fn(),
  emitSlotBooked: vi.fn(),
  emitSlotReleased: vi.fn(),
}));

vi.mock('@/services/downtime.service', () => ({
  downtimeService: {
    isBusinessClosed: vi.fn().mockResolvedValue(false),
    getBusinessSpecialHours: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock('@/services/slot-optimizer.service', () => ({
  slotTemplateCache: { getTemplate: vi.fn().mockReturnValue([]) },
  slotPoolManager: { queueGeneration: vi.fn().mockResolvedValue(undefined) },
  dateSlotOptimizer: { getMissingDates: vi.fn().mockResolvedValue([]) },
}));

vi.mock('@/lib/slot-capacity-timeline', () => ({
  canScheduleWithinCapacity: vi.fn().mockReturnValue(true),
  overlapsAnyBlocked: vi.fn().mockReturnValue(false),
}));

describe('slot.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateAuditLog.mockResolvedValue(null);
  });

  describe('getSlotById', () => {
    it('returns slot when repository returns one', async () => {
      const slot = {
        id: 'slot-1',
        business_id: 'bus-1',
        date: '2025-03-15',
        start_time: '09:00:00',
        end_time: '09:30:00',
        status: SLOT_STATUS.AVAILABLE,
        reserved_until: null,
        created_at: '2025-03-01T00:00:00Z',
      };
      mockGetSlotById.mockResolvedValue(slot);
      const out = await slotService.getSlotById('slot-1');
      expect(out).toEqual(slot);
      expect(mockGetSlotById).toHaveBeenCalledWith('slot-1');
    });

    it('returns null when repository returns null', async () => {
      mockGetSlotById.mockResolvedValue(null);
      const out = await slotService.getSlotById('nonexistent');
      expect(out).toBeNull();
    });
  });

  describe('reserveSlot', () => {
    it('returns false when slot not found', async () => {
      mockGetSlotById.mockResolvedValue(null);
      const out = await slotService.reserveSlot('slot-1');
      expect(out).toBe(false);
      expect(mockSetSlotReserved).not.toHaveBeenCalled();
    });

    it('returns false when slot cannot transition to reserved', async () => {
      mockGetSlotById.mockResolvedValue({
        id: 'slot-1',
        business_id: 'bus-1',
        date: '2025-03-15',
        start_time: '09:00:00',
        end_time: '09:30:00',
        status: SLOT_STATUS.BOOKED,
        reserved_until: null,
        created_at: '2025-03-01T00:00:00Z',
      });
      const out = await slotService.reserveSlot('slot-1');
      expect(out).toBe(false);
      expect(mockSetSlotReserved).not.toHaveBeenCalled();
    });

    it('returns true and calls setSlotReserved when slot is available', async () => {
      const slot = {
        id: 'slot-1',
        business_id: 'bus-1',
        date: '2025-03-15',
        start_time: '09:00:00',
        end_time: '09:30:00',
        status: SLOT_STATUS.AVAILABLE,
        reserved_until: null,
        created_at: '2025-03-01T00:00:00Z',
      };
      mockGetSlotById
        .mockResolvedValue(slot)
        .mockResolvedValueOnce(slot)
        .mockResolvedValueOnce(slot);
      mockSetSlotReserved.mockResolvedValue(true);
      const out = await slotService.reserveSlot('slot-1');
      expect(out).toBe(true);
      expect(mockSetSlotReserved).toHaveBeenCalledWith('slot-1', 'bus-1', expect.any(String));
    });
  });
});
