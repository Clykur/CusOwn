/**
 * Realtime module exports
 */

export { useSlotUpdates, type UseSlotUpdatesOptions } from './use-slot-updates';
export {
  subscribeSlotUpdates,
  slotEventId,
  type SlotRealtimePayload,
  type SlotUpdateEventType,
  type SupabaseRealtime,
  type SubscribeSlotUpdatesOptions,
} from './slot-updates';
export {
  throttle,
  batchUpdates,
  createVisibilityAwareSubscription,
  createEventDeduplicator,
  createRefreshManager,
  createRealtimeMetrics,
  type RealtimeSubscriptionStatus,
  type RealtimeMetrics,
} from './realtime-utils';
