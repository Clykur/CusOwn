/**
 * Routing module exports.
 * Central point for importing routing functionality.
 */

// Graph data structures
export {
  WeightedGraph,
  type GraphNode,
  type GraphEdge,
  type AdjacencyListEntry,
} from './graph-data-structures';

// Algorithms
export { dijkstra, aStar, reconstructPath, computeTravelTime, computeRoute } from './shortest-path';

// Spatial indexing
export { KDTree } from './spatial-index';

// Road network loading
export {
  createSyntheticRoadNetwork,
  createTestNetwork,
  createCitySampleNetwork,
  addBusinessNodesToGraph,
} from './road-network-loader';

// OSM loader not re-exported here (optional dep osm-pbf-parser). Import from './osm-loader' when needed.

// Service layer
export { RoutingService, getRoute } from './routing-service';

// Initialization
export {
  initializeRouting,
  getRoutingService,
  isRoutingServiceReady,
  getRoutingHealth,
  resetRouting,
} from './init';
