/**
 * Performance monitoring exports.
 */

export {
  performanceMonitor,
  recordMetric,
  measureAsync,
  measureSync,
  runWithTiming,
  type PerformanceMetric,
  type MetricType,
} from './performance';

export { initWebVitals, reportWebVitalsToAnalytics } from './web-vitals';

export { recordApiMetric, getApiStats, monitoredFetch, clearApiMetrics } from './api-metrics';

export {
  markHydrationStart,
  markHydrationEnd,
  markNavigationStart,
  measureComponentRender,
  getTimeToInteractive,
  getNavigationTimings,
  recordNavigationTimings,
  getHydrationStats,
} from './hydration';

export {
  startRouteTransition,
  endRouteTransition,
  recordHardNavigation,
  getTransitionHistory,
  getTransitionStats,
  subscribeToTransitions,
  clearTransitionHistory,
} from './route-transitions';

export {
  startInteractionTracking,
  stopInteractionTracking,
  subscribeToInteractions,
  getInteractionStats,
  clearInteractionHistory,
  measureInteraction,
} from './interaction-tracker';

export {
  loadBaselines,
  saveBaselines,
  updateBaselinesFromMetrics,
  checkForRegressions,
  getRegressionReports,
  clearRegressionReports,
  getPerformanceSummary,
  reportToServer,
  subscribeToRegressions,
} from './regression-detector';
