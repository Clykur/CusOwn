/**
 * Routing service - main orchestration layer for graph-based routing.
 * Handles spatial lookup, route computation, caching, and mode selection.
 */

import { env } from '@/config/env';
import { WeightedGraph } from './graph-data-structures';
import { KDTree } from './spatial-index';
import { computeRoute, computeTravelTime } from './shortest-path';
import { haversineDistance, assertValidCoordinates } from '../utils/geo';

/** Sanitize a value for logging to prevent log injection (strip newlines/carriage returns). */
function sanitizeLogValue(value: unknown): string {
  const str = value instanceof Error ? value.message : String(value);
  return str.replace(/[\r\n]+/g, ' ');
}

interface RouteQuery {
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  mode?: 'walking' | 'driving';
}

interface RouteResult {
  distance_km: number;
  estimated_time_minutes: number;
  mode: 'walking' | 'driving';
  routed: boolean; // true if graph-based or OSRM, false if fallback (Haversine)
  source?: 'osrm' | 'internal' | 'fallback';
  segments?: Array<{
    fromNodeId: string;
    toNodeId: string;
    distanceKm: number;
    estimatedTimeMinutes: number;
    roadType?: string;
  }>;
}

/**
 * Cached route entry with TTL.
 */
interface CachedRoute {
  result: RouteResult;
  timestamp: number;
}

/**
 * Main routing service. Singleton pattern.
 * Manages graph loading, spatial indexing, routing, and caching.
 */
export class RoutingService {
  private static instance: RoutingService | null = null;

  private graph: WeightedGraph | null = null;
  private kdTree: KDTree | null = null;
  private cache: Map<string, CachedRoute>;
  private cacheTtlMs: number = 60 * 60 * 1000; // 1 hour
  private isInitialized: boolean = false;

  // OSRM configuration and cache
  private osrmUrl: string | null;
  private osrmCache: Map<string, { result: RouteResult; timestamp: number }>;
  private osrmCacheTtlMs: number = 60 * 60 * 1000; // 1h

  private stats = {
    routesComputed: 0,
    cacheHits: 0,
    cacheMisses: 0,
    fallbacksUsed: 0,
    osrmCalls: 0,
    osrmFailures: 0,
    avgComputeTimeMs: 0,
  };

  private constructor() {
    this.cache = new Map();
    this.osrmCache = new Map();
    this.osrmUrl = env.geo.osrmUrl || null;
  }

  /**
   * Get singleton instance.
   */
  static getInstance(): RoutingService {
    if (!RoutingService.instance) {
      RoutingService.instance = new RoutingService();
    }
    return RoutingService.instance;
  }

  /**
   * Initialize service with a graph.
   */
  initialize(graph: WeightedGraph): void {
    if (this.isInitialized) {
      console.warn('RoutingService already initialized');
      return;
    }

    this.graph = graph;

    // Build spatial index from graph nodes
    const nodes = graph.getAllNodes();
    this.kdTree = new KDTree(nodes);
    this.isInitialized = true;
  }

  /**
   * Check if service is initialized.
   */
  isReady(): boolean {
    return this.isInitialized && this.graph !== null && this.kdTree !== null;
  }

  /**
   * Compute route between two coordinates.
   * Returns routed distance/time if graph available, otherwise falls back to Haversine.
   */
  async computeRoute(query: RouteQuery): Promise<RouteResult> {
    const mode = query.mode || 'walking';
    const cacheKey = this.getCacheKey(
      query.startLat,
      query.startLng,
      query.endLat,
      query.endLng,
      mode
    );

    // Check internal cache first
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      this.stats.cacheHits++;
      return cached;
    }

    this.stats.cacheMisses++;
    const startTime = Date.now();

    let result: RouteResult | null = null;

    // If OSRM url configured, try OSRM first
    if (this.osrmUrl) {
      try {
        this.stats.osrmCalls++;
        result = await this.routeWithOsrm(
          query.startLat,
          query.startLng,
          query.endLat,
          query.endLng,
          mode
        );
        if (result) {
          result.source = 'osrm';
          // compare with internal graph for validation
          if (this.isReady()) {
            const internal = this.routeWithGraph(
              query.startLat,
              query.startLng,
              query.endLat,
              query.endLng,
              mode
            );
            if (internal.routed) {
              const perc =
                Math.abs(result.distance_km - internal.distance_km) / internal.distance_km;
              if (perc > 0.05) {
                console.warn(
                  `OSRM deviation too large: ${Math.round(perc * 100)}% (osrm=${result.distance_km}km, internal=${internal.distance_km}km)`
                );
              }
            }
          }
          // cache osrm result separately if desired
          this.setInCache(cacheKey, result);
          const computeTime = Date.now() - startTime;
          this.stats.routesComputed++;
          this.stats.avgComputeTimeMs =
            (this.stats.avgComputeTimeMs * (this.stats.routesComputed - 1) + computeTime) /
            this.stats.routesComputed;
          return result;
        }
      } catch (err) {
        this.stats.osrmFailures++;
        console.error('OSRM routing failed, falling back:', sanitizeLogValue(err));
      }
    }

    // Either OSRM not configured or failed, fallback to graph/internal logic
    if (!this.isReady()) {
      // Fallback: use Haversine distance
      result = this.fallbackToHaversine(
        query.startLat,
        query.startLng,
        query.endLat,
        query.endLng,
        mode
      );
      result.source = 'fallback';
      this.stats.fallbacksUsed++;
    } else {
      // Use graph-based routing
      result = this.routeWithGraph(
        query.startLat,
        query.startLng,
        query.endLat,
        query.endLng,
        mode
      );
      if (result.routed) {
        result.source = 'internal';
      }
      // If graph routing fails, fall back to Haversine
      if (!result.routed) {
        result = this.fallbackToHaversine(
          query.startLat,
          query.startLng,
          query.endLat,
          query.endLng,
          mode
        );
        result.source = 'fallback';
        this.stats.fallbacksUsed++;
      }
    }

    const computeTime = Date.now() - startTime;
    this.stats.routesComputed++;
    this.stats.avgComputeTimeMs =
      (this.stats.avgComputeTimeMs * (this.stats.routesComputed - 1) + computeTime) /
      this.stats.routesComputed;

    // Cache result (source may be internal or fallback)
    this.setInCache(cacheKey, result);

    return result;
  }

  /**
   * Route using graph if available.
   */
  private routeWithGraph(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    mode: 'walking' | 'driving'
  ): RouteResult {
    // This should never be null/undefined if isReady() is true, but TypeScript safety
    if (!this.graph || !this.kdTree) {
      return {
        distance_km: 0,
        estimated_time_minutes: 0,
        mode,
        routed: false,
      };
    }

    // Find nearest start and end nodes
    const startNode = this.kdTree.findNearest(startLat, startLng);
    const endNode = this.kdTree.findNearest(endLat, endLng);

    if (!startNode || !endNode) {
      return {
        distance_km: 0,
        estimated_time_minutes: 0,
        mode,
        routed: false,
      };
    }

    // Compute route using A* algorithm
    const route = computeRoute(this.graph, startNode.id, endNode.id, mode, true); // useAStar=true

    if (!route) {
      return {
        distance_km: 0,
        estimated_time_minutes: 0,
        mode,
        routed: false,
      };
    }

    return {
      distance_km: route.totalDistanceKm,
      estimated_time_minutes: route.totalTimeMinutes,
      mode: route.mode,
      routed: true,
      source: 'internal',
      segments: route.segments,
    };
  }

  /**
   * Fallback routing using Haversine distance + mode-based speed.
   */
  private fallbackToHaversine(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    mode: 'walking' | 'driving'
  ): RouteResult {
    const distance = haversineDistance(startLat, startLng, endLat, endLng);
    const speed = mode === 'walking' ? 4.5 : 50; // km/h
    const timeMinutes = computeTravelTime(distance, mode);

    return {
      distance_km: distance,
      estimated_time_minutes: timeMinutes,
      mode,
      routed: false,
      source: 'fallback',
    };
  }

  /**
   * Attempt to compute route using local OSRM server.
   * Returns null if OSRM is not configured or the call fails.
   */
  private async routeWithOsrm(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    mode: 'walking' | 'driving'
  ): Promise<RouteResult | null> {
    if (!this.osrmUrl) return null;

    // Defensive: ensure coordinates are valid before using them in an external request URL (SSRF mitigation).
    assertValidCoordinates(startLat, startLng);
    assertValidCoordinates(endLat, endLng);

    const profile = mode === 'walking' ? 'foot' : 'car';
    const url = `${this.osrmUrl}/route/v1/${profile}/${startLng},${startLat};${endLng},${endLat}?overview=false`;
    const cacheKey = `osrm:${profile}:${startLat},${startLng}:${endLat},${endLng}`;

    // check osrm cache
    const cached = this.osrmCache.get(cacheKey);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      if (age <= this.osrmCacheTtlMs) {
        return cached.result;
      } else {
        this.osrmCache.delete(cacheKey);
      }
    }

    try {
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(`OSRM request failed ${resp.status}`);
      }
      const data: any = await resp.json();
      if (data.routes && data.routes.length > 0) {
        const r: any = data.routes[0];
        const result: RouteResult = {
          distance_km: r.distance / 1000,
          estimated_time_minutes: r.duration / 60,
          mode,
          routed: true,
          source: 'osrm',
        };
        this.osrmCache.set(cacheKey, { result, timestamp: Date.now() });
        return result;
      }
      return null;
    } catch (err) {
      console.error('OSRM error:', sanitizeLogValue(err));
      return null;
    }
  }

  /**
   * Get cache key for a route query.
   */
  private getCacheKey(
    startLat: number,
    startLng: number,
    endLat: number,
    endLng: number,
    mode: string
  ): string {
    // Round to 5 decimal places (~1m precision) to allow fuzzy matching
    const round = (n: number) => Math.round(n * 100000) / 100000;
    return `${round(startLat)},${round(startLng)}-${round(endLat)},${round(endLng)}-${mode}`;
  }

  /**
   * Get route from cache if available and not expired.
   */
  private getFromCache(key: string): RouteResult | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const age = Date.now() - cached.timestamp;
    if (age > this.cacheTtlMs) {
      this.cache.delete(key);
      return null;
    }

    return cached.result;
  }

  /**
   * Store route in cache.
   */
  private setInCache(key: string, result: RouteResult): void {
    this.cache.set(key, {
      result,
      timestamp: Date.now(),
    });
  }

  /**
   * Clear entire cache.
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics.
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      hitRate: this.stats.routesComputed > 0 ? this.stats.cacheHits / this.stats.routesComputed : 0,
      totalRoutes: this.stats.routesComputed,
      fallbacksUsed: this.stats.fallbacksUsed,
      avgComputeTimeMs: Number(this.stats.avgComputeTimeMs.toFixed(2)),
    };
  }

  getOsrmStats() {
    return {
      osrmConfigured: !!this.osrmUrl,
      calls: this.stats.osrmCalls,
      failures: this.stats.osrmFailures,
      cacheSize: this.osrmCache.size,
    };
  }

  /**
   * Get graph statistics.
   */
  getGraphStats() {
    if (!this.graph) {
      return {
        nodes: 0,
        edges: 0,
        initialized: false,
      };
    }

    return {
      nodes: this.graph.getNodeCount(),
      edges: this.graph.getEdgeCount(),
      initialized: this.isInitialized,
    };
  }

  /**
   * Reset service (for testing).
   */
  reset(): void {
    this.graph = null;
    this.kdTree = null;
    this.cache.clear();
    this.osrmCache.clear();
    this.isInitialized = false;
    this.stats = {
      routesComputed: 0,
      cacheHits: 0,
      cacheMisses: 0,
      fallbacksUsed: 0,
      osrmCalls: 0,
      osrmFailures: 0,
      avgComputeTimeMs: 0,
    };
  }
}

/**
 * Convenience function to get routing service and compute a route.
 */
export async function getRoute(query: RouteQuery): Promise<RouteResult> {
  const service = RoutingService.getInstance();
  return service.computeRoute(query);
}
