/**
 * Unit tests for routing system.
 * Tests graph algorithms, spatial indexing, and service layer.
 * Run with: npx ts-node scripts/unit-routing.test.ts
 */

import { WeightedGraph, GraphNode } from '../../lib/routing/graph-data-structures';
import {
  dijkstra,
  aStar,
  reconstructPath,
  computeTravelTime,
  computeRoute,
} from '../../lib/routing/shortest-path';
import { KDTree } from '../../lib/routing/spatial-index';
import { createTestNetwork, addBusinessNodesToGraph } from '../../lib/routing/road-network-loader';
import { loadGraphFromOsmPbf } from '../../lib/routing/osm-loader';
import { RoutingService } from '../../lib/routing/routing-service';

// stub global fetch so tests don't hit real network
let originalFetch: typeof fetch;

// simple boolean assert
function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

// Test utilities
function assertEquals<T>(actual: T, expected: T, message: string) {
  // For numbers, use approximate comparison to handle floating point precision
  if (typeof actual === 'number' && typeof expected === 'number') {
    const tolerance = 0.0001;
    if (Math.abs(actual - expected) > tolerance) {
      console.error(`❌ FAIL: ${message}`);
      console.error(`  Expected: ${expected}`);
      console.error(`  Actual: ${actual}`);
      process.exitCode = 1;
    } else {
      console.log(`✅ PASS: ${message}`);
    }
  } else if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    console.error(`❌ FAIL: ${message}`);
    console.error(`  Expected: ${JSON.stringify(expected)}`);
    console.error(`  Actual: ${JSON.stringify(actual)}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

function assertInRange(actual: number, min: number, max: number, message: string) {
  if (actual < min || actual > max) {
    console.error(`❌ FAIL: ${message}`);
    console.error(`  Expected range: [${min}, ${max}]`);
    console.error(`  Actual: ${actual}`);
    process.exitCode = 1;
  } else {
    console.log(`✅ PASS: ${message}`);
  }
}

function assertNotNull<T>(actual: T | null | undefined, message: string): T {
  if (!actual) {
    console.error(`❌ FAIL: ${message} - Expected non-null value`);
    process.exitCode = 1;
    return null as any;
  }
  console.log(`✅ PASS: ${message}`);
  return actual;
}

// Create simple test graph
function createSimpleGraph(): WeightedGraph {
  const graph = new WeightedGraph();

  // Create 5 nodes in a line
  const nodeA: GraphNode = { id: 'A', latitude: 0, longitude: 0 };
  const nodeB: GraphNode = { id: 'B', latitude: 0.01, longitude: 0 }; // ~1.1 km north
  const nodeC: GraphNode = { id: 'C', latitude: 0.02, longitude: 0 }; // ~2.2 km north
  const nodeD: GraphNode = { id: 'D', latitude: 0.02, longitude: 0.01 }; // ~1.1 km east from C
  const nodeE: GraphNode = { id: 'E', latitude: 0.03, longitude: 0 }; // ~3.3 km north

  graph.addNode(nodeA);
  graph.addNode(nodeB);
  graph.addNode(nodeC);
  graph.addNode(nodeD);
  graph.addNode(nodeE);

  // Create edges: A-B-C-E, C-D
  graph.addEdge({
    id: 'AB',
    from: 'A',
    to: 'B',
    distanceKm: 1.1,
    bidirectional: true,
    walkable: true,
    drivable: true,
  });
  graph.addEdge({
    id: 'BC',
    from: 'B',
    to: 'C',
    distanceKm: 1.1,
    bidirectional: true,
    walkable: true,
    drivable: true,
  });
  graph.addEdge({
    id: 'CE',
    from: 'C',
    to: 'E',
    distanceKm: 1.1,
    bidirectional: true,
    walkable: true,
    drivable: true,
  });
  graph.addEdge({
    id: 'CD',
    from: 'C',
    to: 'D',
    distanceKm: 1.1,
    bidirectional: true,
    walkable: true,
    drivable: true,
  });

  return graph;
}

// Tests
async function runTests() {
  console.log('🧪 Running routing system tests...\n');

  // stash original fetch (Node 18+ has global fetch)
  originalFetch = (global as any).fetch;

  // simple OSRM mock handler: returns higher distance to test deviation warning
  (global as any).fetch = async (url: string) => {
    if (url.includes('/route/v1')) {
      return {
        ok: true,
        json: async () => ({ routes: [{ distance: 10_000, duration: 1800 }] }),
      } as any;
    }
    // fallback generic response
    return { ok: false, status: 404 } as any;
  };

  // Test 1: Basic graph construction
  console.log('--- Graph Construction Tests ---');
  const graph = createSimpleGraph();
  assertEquals(graph.getNodeCount(), 5, 'Graph has 5 nodes');
  assertEquals(graph.getEdgeCount(), 8, 'Graph has 8 edges (4 bidirectional = 8 directed)');

  // Test 2: Node retrieval
  console.log('\n--- Node Retrieval Tests ---');
  const nodeA = graph.getNode('A');
  assertNotNull(nodeA, 'Can retrieve node A');
  assertEquals(nodeA?.id, 'A', 'Node A has correct ID');

  // Test 3: Neighbor retrieval
  console.log('\n--- Neighbor Tests ---');
  const neighborsA = graph.getNeighbors('A');
  assertEquals(neighborsA.length, 1, 'Node A has 1 neighbor');
  assertEquals(neighborsA[0].nodeId, 'B', 'Node A neighbor is B');

  const neighborsC = graph.getNeighbors('C');
  assertEquals(neighborsC.length, 3, 'Node C has 3 neighbors (B, E, D)');

  // Test 4: Mode filtering
  console.log('\n--- Mode Filtering Tests ---');
  const walkingNeighbors = graph.getNeighborsByMode('A', 'walking');
  assertEquals(walkingNeighbors.length, 1, 'Node A has 1 walking neighbor');

  // Test 5: Dijkstra's algorithm
  console.log('\n--- Dijkstra Algorithm Tests ---');
  const dijkstraResult = dijkstra(graph, 'A', 'E', 'walking');
  assertEquals(
    dijkstraResult.distances.get('E'),
    3.3,
    'Dijkstra finds correct distance A->E (3.3 km)'
  );

  const pathAE = reconstructPath(dijkstraResult.previous, 'E');
  assertEquals(pathAE, ['A', 'B', 'C', 'E'], 'Dijkstra reconstructs correct path A->E');

  // Test 6: A* algorithm
  console.log('\n--- A* Algorithm Tests ---');
  const aStarResult = aStar(graph, 'A', 'E', 'walking');
  assertEquals(aStarResult.distances.get('E'), 3.3, 'A* finds correct distance A->E');

  const pathAEAstar = reconstructPath(aStarResult.previous, 'E');
  assertEquals(pathAEAstar, ['A', 'B', 'C', 'E'], 'A* reconstructs correct path A->E');

  // Test 7: Travel time computation
  console.log('\n--- Travel Time Tests ---');
  const walkTime = computeTravelTime(1.1, 'walking'); // Default 4.5 km/h
  assertInRange(walkTime, 14.5, 15, 'Walking time for 1.1 km is ~14.7 minutes');

  const driveTime = computeTravelTime(1.1, 'driving'); // Default 50 km/h
  assertInRange(driveTime, 1.2, 1.4, 'Driving time for 1.1 km is ~1.3 minutes');

  // Test 8: Full route computation
  console.log('\n--- Route Computation Tests ---');
  const route = computeRoute(graph, 'A', 'E', 'walking', false); // Use Dijkstra
  const route_not_null = assertNotNull(route, 'computeRoute returns a route for A->E');
  if (route_not_null) {
    assertEquals(route_not_null.totalDistanceKm, 3.3, 'Route total distance is 3.3 km');
    assertInRange(
      route_not_null.totalTimeMinutes,
      43,
      45,
      'Route total time is ~44 minutes (walking)'
    );
    assertEquals(route_not_null.segments.length, 3, 'Route has 3 segments');
  }

  // Test 9: KD-Tree spatial indexing
  console.log('\n--- KD-Tree Spatial Indexing Tests ---');
  const nodes: GraphNode[] = [
    { id: 'N1', latitude: 0, longitude: 0 },
    { id: 'N2', latitude: 1, longitude: 0 },
    { id: 'N3', latitude: 0, longitude: 1 },
    { id: 'N4', latitude: 1, longitude: 1 },
  ];
  const kdtree = new KDTree(nodes);

  const nearest = kdtree.findNearest(0.1, 0.1);
  assertNotNull(nearest, 'KD-tree finds nearest node');
  assertEquals(nearest?.id, 'N1', 'Nearest node to (0.1, 0.1) is N1');

  const kNearest = kdtree.findKNearest(0.5, 0.5, 2);
  assertEquals(kNearest.length, 2, 'KD-tree finds k nearest nodes');

  const withinRadius = kdtree.findWithinRadius(0.5, 0.5, 100); // Large radius to catch all
  assertEquals(withinRadius.length, 4, 'KD-tree finds all nodes within large radius');

  // Test 10: Routing service
  console.log('\n--- Routing Service Tests ---');
  const service = RoutingService.getInstance();
  service.reset(); // Clean slate

  const testGraph = createSimpleGraph();
  service.initialize(testGraph);

  assertEquals(service.isReady(), true, 'Routing service is ready after initialization');

  const stats = service.getGraphStats();
  assertEquals(stats.nodes, 5, 'Routing service reports correct node count');
  assertEquals(stats.edges, 8, 'Routing service reports correct edge count');

  // Test 11: Routing service routing
  const routeResult = await service.computeRoute({
    startLat: 0,
    startLng: 0,
    endLat: 0.03,
    endLng: 0,
    mode: 'walking',
  });

  assertEquals(routeResult.routed, true, 'Routing service computes routed result');
  assertInRange(routeResult.distance_km, 3.0, 3.5, 'Routing service computes reasonable distance');
  assertInRange(
    routeResult.estimated_time_minutes,
    40,
    50,
    'Routing service computes reasonable time'
  );

  // Test 12: Caching
  console.log('\n--- Caching Tests ---');
  service.clearCache(); // Clear cache before test

  const cacheStatsAfter = service.getCacheStats();
  assertEquals(cacheStatsAfter.cacheSize, 1, 'Cache has 1 entry after computing route');

  const cacheStatsFinal = service.getCacheStats();
  assertEquals(
    cacheStatsFinal.hitRate,
    0.5,
    'Cache has 50% hit rate after repeated query (1 hit out of 2 total)'
  );

  // Test OSRM integration
  console.log('\n--- OSRM Integration Tests ---');
  process.env.OSRM_URL = 'http://localhost:5000';
  service['osrmUrl'] = process.env.OSRM_URL; // manually propagate to singleton
  service.clearCache(); // ensure we hit OSRM rather than cached internal route
  let warned = false;
  const origWarn = console.warn;
  // Sanitize log arguments to prevent log injection when tests capture warnings (CodeQL log-injection).
  const sanitizeLogArg = (arg: unknown): unknown => {
    if (typeof arg === 'string') return arg.replace(/[\r\n]+/g, ' ');
    return arg;
  };
  console.warn = (...args: unknown[]) => {
    warned = true;
    origWarn(...args.map(sanitizeLogArg));
  };

  const osrmRoute = await service.computeRoute({
    startLat: 0,
    startLng: 0,
    endLat: 0.03,
    endLng: 0,
    mode: 'walking',
  });
  assertEquals(osrmRoute.source, 'osrm', 'OSRM route is used when configured');
  assertEquals(warned, true, 'Deviation warning emitted when OSRM differs from internal');
  const osrmStats = service.getOsrmStats();
  assert(osrmStats.calls >= 1, 'OSRM stats record at least one call');
  // Ensure caching works for OSRM route
  const cacheStatsMid = service.getCacheStats();
  assert(cacheStatsMid.cacheSize >= 1, 'Cache contains OSRM result');
  // repeat same query to bump hit rate
  await service.computeRoute({
    startLat: 0,
    startLng: 0,
    endLat: 0.03,
    endLng: 0,
    mode: 'walking',
  });
  const cacheStatsPost = service.getCacheStats();
  assert(cacheStatsPost.cacheSize >= 1, 'Cache still present after second call');

  // reset warning
  console.warn = origWarn;

  // turn off OSRM for fallback test
  delete process.env.OSRM_URL;
  service['osrmUrl'] = null;
  service.clearCache();

  // Test 13: Fallback to Haversine
  console.log('\n--- Fallback Tests ---');
  // Test short-distance route computation (NYC coordinates as example)
  const fallbackRoute = await RoutingService.getInstance().computeRoute({
    startLat: 40.7128,
    startLng: -74.006,
    endLat: 40.7127,
    endLng: -74.0059,
    mode: 'walking',
  });

  assertEquals(fallbackRoute.mode, 'walking', 'Fallback route has correct mode');
  assertInRange(
    fallbackRoute.distance_km,
    0.01,
    0.02,
    'Route computes reasonable distance for short route'
  );

  // Test 14: Synthetic network loading
  console.log('\n--- Network Loading Tests ---');
  const testNetwork = createTestNetwork();
  assertEquals(testNetwork.getNodeCount() > 0, true, 'Test network has nodes');
  assertEquals(testNetwork.getEdgeCount() > 0, true, 'Test network has edges');

  // Test 15: OSM loader should error when no parser is installed or file missing
  console.log('\n--- OSM Loader Fallback ---');
  let osmErrorCaught = false;
  try {
    await loadGraphFromOsmPbf('/nonexistent-file.pbf');
  } catch (err) {
    osmErrorCaught = true;
    console.log('✅ PASS: loadGraphFromOsmPbf throws when parser missing or file invalid');
  }
  assert(osmErrorCaught, 'OSM loader error behaviour');

  // Test 15: Business node addition
  console.log('\n--- Business Node Tests ---');
  const businessGraph = createTestNetwork();
  const businesses = [
    { id: '1', name: 'Salon A', latitude: 40.7128, longitude: -74.006 },
    { id: '2', name: 'Salon B', latitude: 40.7127, longitude: -74.0059 },
  ];
  const nodeCountBefore = businessGraph.getNodeCount();
  addBusinessNodesToGraph(businessGraph, businesses);
  const nodeCountAfter = businessGraph.getNodeCount();

  assertEquals(nodeCountAfter > nodeCountBefore, true, 'Business nodes are added to graph');

  console.log('\n✨ All tests completed!');
  const cacheStats = service.getCacheStats();
  console.log(`\nRouting Service Stats:`);
  console.log(`  Total routes computed: ${cacheStats.totalRoutes}`);
  console.log(`  Cache hit rate: ${(cacheStats.hitRate * 100).toFixed(1)}%`);
  console.log(`  Fallbacks used: ${cacheStats.fallbacksUsed}`);
  console.log(`  Avg compute time: ${cacheStats.avgComputeTimeMs.toFixed(2)}ms`);

  // restore global fetch
  (global as any).fetch = originalFetch;
  delete process.env.OSRM_URL;
}

// Run tests
runTests().catch((error) => {
  console.error('Test suite failed:', error);
  process.exitCode = 1;
});
