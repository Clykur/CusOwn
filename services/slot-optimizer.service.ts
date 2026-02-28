/**
 * Slot Optimizer Service - DSA-based optimization for slot generation
 *
 * Uses:
 * - HashMap for slot template caching (O(1) lookup)
 * - Trie-like structure for date-based slot lookup
 * - Pool pattern for batch slot generation
 * - LRU cache for frequently accessed slot configs
 */

import { generateTimeSlots } from '@/lib/utils/time';
import { SLOT_STATUS } from '@/config/constants';

type SalonTimeConfig = {
  opening_time: string;
  closing_time: string;
  slot_duration: number;
};

type SlotTemplate = {
  timeSlots: Array<{ start: string; end: string }>;
  configKey: string;
  lastUsed: number;
};

/**
 * HashMap-based Slot Template Cache
 * Key: "opening-closing-duration" (e.g., "09:00-18:00-30")
 * Value: Pre-computed time slots array
 */
class SlotTemplateCache {
  private cache: Map<string, SlotTemplate> = new Map();
  private maxSize: number = 100; // LRU cache size limit
  private accessOrder: string[] = []; // Track access order for LRU eviction

  /**
   * Generate cache key from config
   * O(1) key generation
   */
  private getConfigKey(config: SalonTimeConfig): string {
    return `${config.opening_time}-${config.closing_time}-${config.slot_duration}`;
  }

  /**
   * Get or generate slot template
   * O(1) lookup + O(n) generation (only on cache miss)
   */
  getTemplate(config: SalonTimeConfig): Array<{ start: string; end: string }> {
    const key = this.getConfigKey(config);

    // Check cache first (O(1) lookup)
    const cached = this.cache.get(key);
    if (cached) {
      // Update access order for LRU
      this.updateAccessOrder(key);
      cached.lastUsed = Date.now();
      return cached.timeSlots;
    }

    // Generate new template (O(n) where n = number of slots)
    const timeSlots = generateTimeSlots(
      config.opening_time,
      config.closing_time,
      config.slot_duration
    );

    // Add to cache
    this.addToCache(key, timeSlots);

    return timeSlots;
  }

  /**
   * Update access order for LRU eviction
   */
  private updateAccessOrder(key: string): void {
    const index = this.accessOrder.indexOf(key);
    if (index > -1) {
      this.accessOrder.splice(index, 1);
    }
    this.accessOrder.push(key);
  }

  /**
   * Add template to cache with LRU eviction
   */
  private addToCache(key: string, timeSlots: Array<{ start: string; end: string }>): void {
    // Evict least recently used if cache is full
    if (this.cache.size >= this.maxSize && this.accessOrder.length > 0) {
      const lruKey = this.accessOrder.shift()!;
      this.cache.delete(lruKey);
    }

    this.cache.set(key, {
      timeSlots,
      configKey: key,
      lastUsed: Date.now(),
    });
    this.accessOrder.push(key);
  }

  /**
   * Clear cache (useful for testing or memory management)
   */
  clear(): void {
    this.cache.clear();
    this.accessOrder = [];
  }

  /**
   * Get cache stats
   */
  getStats(): { size: number; maxSize: number; keys: string[] } {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      keys: Array.from(this.cache.keys()),
    };
  }
}

/**
 * Slot Pool Manager - Batch generate slots for multiple businesses
 * Uses pooling pattern to reduce database load
 */
class SlotPoolManager {
  private pendingGenerations: Map<string, Promise<void>> = new Map();
  private generationQueue: Array<{
    businessId: string;
    date: string;
    config: SalonTimeConfig;
    resolve: () => void;
    reject: (error: Error) => void;
  }> = [];

  /**
   * Batch generate slots for multiple businesses with same config
   * Groups by config to maximize template cache hits
   */
  async batchGenerateSlots(
    requests: Array<{
      businessId: string;
      date: string;
      config: SalonTimeConfig;
    }>,
    generateFn: (businessId: string, date: string, config: SalonTimeConfig) => Promise<void>
  ): Promise<void> {
    // Group by config to maximize cache hits
    const configGroups = new Map<string, typeof requests>();

    for (const request of requests) {
      const configKey = `${request.config.opening_time}-${request.config.closing_time}-${request.config.slot_duration}`;
      if (!configGroups.has(configKey)) {
        configGroups.set(configKey, []);
      }
      configGroups.get(configKey)!.push(request);
    }

    // Process each config group in parallel
    const promises = Array.from(configGroups.values()).map(async (group) => {
      // Process businesses in parallel within same config group
      await Promise.all(group.map((req) => generateFn(req.businessId, req.date, req.config)));
    });

    await Promise.all(promises);
  }

  /**
   * Queue slot generation to avoid duplicate concurrent requests
   */
  async queueGeneration(
    businessId: string,
    date: string,
    config: SalonTimeConfig,
    generateFn: (businessId: string, date: string, config: SalonTimeConfig) => Promise<void>
  ): Promise<void> {
    const key = `${businessId}-${date}`;

    // Check if already generating
    const existing = this.pendingGenerations.get(key);
    if (existing) {
      return existing;
    }

    // Create new generation promise
    const promise = generateFn(businessId, date, config).finally(() => {
      this.pendingGenerations.delete(key);
    });

    this.pendingGenerations.set(key, promise);
    return promise;
  }
}

/**
 * Date-based Slot Lookup Optimizer
 * Uses efficient date range queries
 */
class DateSlotOptimizer {
  /**
   * Get date range for slot generation
   * Only generates slots for dates that don't exist
   */
  async getMissingDates(
    businessId: string,
    startDate: string,
    days: number,
    checkExistsFn: (businessId: string, date: string) => Promise<boolean>
  ): Promise<string[]> {
    const missingDates: string[] = [];
    const today = new Date(startDate + 'T00:00:00');

    // Check dates in parallel batches
    const dateChecks: Promise<{ date: string; exists: boolean }>[] = [];

    for (let i = 0; i < days; i++) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + i);
      const dateString = targetDate.toISOString().split('T')[0];

      dateChecks.push(
        checkExistsFn(businessId, dateString).then((exists) => ({
          date: dateString,
          exists,
        }))
      );
    }

    const results = await Promise.all(dateChecks);

    for (const { date, exists } of results) {
      if (!exists) {
        missingDates.push(date);
      }
    }

    return missingDates;
  }
}

// Singleton instances
export const slotTemplateCache = new SlotTemplateCache();
export const slotPoolManager = new SlotPoolManager();
export const dateSlotOptimizer = new DateSlotOptimizer();

/**
 * Optimized slot generation helper
 * Uses template cache to avoid recalculating time slots
 */
export async function generateOptimizedSlots(
  businessId: string,
  date: string,
  config: SalonTimeConfig,
  insertFn: (slots: Array<Omit<any, 'id' | 'created_at'>>) => Promise<void>
): Promise<void> {
  // Get template from cache (O(1) lookup, O(n) generation only on miss)
  const timeSlots = slotTemplateCache.getTemplate(config);

  // Build slot objects
  const slotsToCreate = timeSlots.map((timeSlot) => ({
    business_id: businessId,
    date,
    start_time: timeSlot.start,
    end_time: timeSlot.end,
    status: SLOT_STATUS.AVAILABLE,
  }));

  // Batch insert
  await insertFn(slotsToCreate);
}

/**
 * Batch generate slots for multiple businesses efficiently
 */
export async function batchGenerateSlotsOptimized(
  requests: Array<{
    businessId: string;
    date: string;
    config: SalonTimeConfig;
  }>,
  insertFn: (businessId: string, slots: Array<Omit<any, 'id' | 'created_at'>>) => Promise<void>
): Promise<void> {
  // Group by config to maximize cache hits
  const configGroups = new Map<string, typeof requests>();

  for (const request of requests) {
    const configKey = `${request.config.opening_time}-${request.config.closing_time}-${request.config.slot_duration}`;
    if (!configGroups.has(configKey)) {
      configGroups.set(configKey, []);
    }
    configGroups.get(configKey)!.push(request);
  }

  // Process each config group
  for (const [configKey, group] of configGroups) {
    // Get template once for entire group (cache hit)
    const firstConfig = group[0].config;
    const timeSlots = slotTemplateCache.getTemplate(firstConfig);

    // Generate slots for all businesses in this config group
    const insertPromises = group.map(async (req) => {
      const slotsToCreate = timeSlots.map((timeSlot) => ({
        business_id: req.businessId,
        date: req.date,
        start_time: timeSlot.start,
        end_time: timeSlot.end,
        status: SLOT_STATUS.AVAILABLE,
      }));

      await insertFn(req.businessId, slotsToCreate);
    });

    await Promise.all(insertPromises);
  }
}
