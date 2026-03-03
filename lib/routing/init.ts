/**
 * Server-side routing initialization.
 * Call this on app startup to load the graph and initialize the routing service.
 */

import { WeightedGraph } from './graph-data-structures';
import { createCitySampleNetwork, addBusinessNodesToGraph } from './road-network-loader';
import { RoutingService } from './routing-service';

let initPromise: Promise<void> | null = null;

/**
 * Initialize routing service on server startup.
 * Should be called once during app initialization (in middleware or layout component).
 * Returns a promise that resolves when initialization is complete.
 */
export async function initializeRouting(options?: {
  useTestNetwork?: boolean;
  osmPbfPath?: string; // if provided, load graph from the given OSM pbf file
  businesses?: Array<{ id: string; name: string; latitude: number; longitude: number }>;
}): Promise<void> {
  // Prevent multiple simultaneous initializations
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const service = RoutingService.getInstance();

      // Skip if already initialized
      if (service.isReady()) {
        return;
      }

      // Load graph
      let graph: WeightedGraph;
      if (options?.osmPbfPath) {
        const { loadGraphFromOsmPbf } = await import('./osm-loader');
        graph = await loadGraphFromOsmPbf(options.osmPbfPath);
      } else if (options?.useTestNetwork) {
        graph = createCitySampleNetwork();
      } else {
        graph = createCitySampleNetwork();
      }

      // Add sample businesses if provided
      if (options?.businesses && options.businesses.length > 0) {
        addBusinessNodesToGraph(graph, options.businesses);
      }

      // Initialize service with graph
      service.initialize(graph);
    } catch (error) {
      console.error('Failed to initialize routing service:', error);
      throw error;
    }
  })();

  return initPromise;
}

/**
 * Get the routing service instance (lazy-init safe).
 */
export function getRoutingService(): RoutingService {
  return RoutingService.getInstance();
}

/**
 * Check if routing service is ready.
 */
export function isRoutingServiceReady(): boolean {
  return RoutingService.getInstance().isReady();
}

/**
 * Get routing service health info.
 */
export function getRoutingHealth() {
  const service = RoutingService.getInstance();
  return {
    ready: service.isReady(),
    graphStats: service.getGraphStats(),
    cacheStats: service.getCacheStats(),
    osrmStats: service.getOsrmStats(),
  };
}

/**
 * Reset routing service (for testing).
 */
export function resetRouting(): void {
  RoutingService.getInstance().reset();
  initPromise = null;
}
