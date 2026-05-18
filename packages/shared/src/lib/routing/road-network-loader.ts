/**
 * Road network data loader.
 * Populates the graph with road nodes and edges from various sources.
 * For production, load from Overpass API or a local OSM dataset.
 * For testing/development, uses synthetic grid-based road networks.
 */

import { WeightedGraph, GraphNode, GraphEdge } from './graph-data-structures';

interface SyntheticNetworkOptions {
  centerLat: number;
  centerLng: number;
  gridSpacingKm: number; // Distance between nodes in the grid
  gridSize: number; // Number of nodes per side (gridSize x gridSize)
  roadType: string;
}

/**
 * Create a synthetic grid-based road network for testing.
 * Useful for development and benchmarking before connecting to real OSM data.
 */
export function createSyntheticRoadNetwork(options: SyntheticNetworkOptions): WeightedGraph {
  const graph = new WeightedGraph();
  const { centerLat, centerLng, gridSpacingKm, gridSize, roadType } = options;

  // Rough conversion: 1 degree latitude ≈ 111 km
  const degreesPerKm = 1 / 111.32;
  const latSpacing = gridSpacingKm * degreesPerKm;
  const lngSpacing = (gridSpacingKm * degreesPerKm) / Math.cos((centerLat * Math.PI) / 180);

  // Create grid nodes
  const nodes: Map<string, GraphNode> = new Map();
  const nodeIds: string[][] = [];

  for (let i = 0; i < gridSize; i++) {
    nodeIds[i] = [];
    for (let j = 0; j < gridSize; j++) {
      const lat = centerLat - (i - gridSize / 2) * latSpacing;
      const lng = centerLng + (j - gridSize / 2) * lngSpacing;
      const nodeId = `grid-${i}-${j}`;

      const node: GraphNode = {
        id: nodeId,
        latitude: lat,
        longitude: lng,
        metadata: { type: 'intersection', gridI: i, gridJ: j },
      };

      nodes.set(nodeId, node);
      nodeIds[i][j] = nodeId;
      graph.addNode(node);
    }
  }

  // Create edges (roads) connecting adjacent nodes
  for (let i = 0; i < gridSize; i++) {
    for (let j = 0; j < gridSize; j++) {
      const currentId = nodeIds[i][j];
      const currentNode = nodes.get(currentId)!;

      // Horizontal edge (right)
      if (j < gridSize - 1) {
        const rightId = nodeIds[i][j + 1];
        const rightNode = nodes.get(rightId)!;
        const distance = haversineDistance(
          currentNode.latitude,
          currentNode.longitude,
          rightNode.latitude,
          rightNode.longitude
        );

        const edge: GraphEdge = {
          id: `edge-${currentId}-${rightId}`,
          from: currentId,
          to: rightId,
          distanceKm: distance,
          roadType,
          bidirectional: true,
          walkable: true,
          drivable: true,
        };

        graph.addEdge(edge);
      }

      // Vertical edge (down)
      if (i < gridSize - 1) {
        const downId = nodeIds[i + 1][j];
        const downNode = nodes.get(downId)!;
        const distance = haversineDistance(
          currentNode.latitude,
          currentNode.longitude,
          downNode.latitude,
          downNode.longitude
        );

        const edge: GraphEdge = {
          id: `edge-${currentId}-${downId}`,
          from: currentId,
          to: downId,
          distanceKm: distance,
          roadType,
          bidirectional: true,
          walkable: true,
          drivable: true,
        };

        graph.addEdge(edge);
      }
    }
  }

  return graph;
}

/**
 * Load a minimal test network (small grid for quick testing).
 */
export function createTestNetwork(): WeightedGraph {
  return createSyntheticRoadNetwork({
    centerLat: 40.7128, // NYC
    centerLng: -74.006,
    gridSpacingKm: 0.5, // 500m blocks
    gridSize: 5, // 5x5 grid
    roadType: 'local_road',
  });
}

/**
 * Load a larger sample network (e.g., for a city).
 */
export function createCitySampleNetwork(): WeightedGraph {
  return createSyntheticRoadNetwork({
    centerLat: 40.7128, // NYC
    centerLng: -74.006,
    gridSpacingKm: 0.3, // 300m blocks
    gridSize: 10, // 10x10 grid
    roadType: 'city_street',
  });
}

/**
 * Add business nodes to graph by snapping them to nearest intersection.
 * In production, you'd snap using actual road mapping.
 * Here, we simply add each business as a node and connect it to nearest grid node.
 */
export function addBusinessNodesToGraph(
  graph: WeightedGraph,
  businesses: Array<{
    id: string;
    name: string;
    latitude: number;
    longitude: number;
  }>
): void {
  const gridNodes = graph.getAllNodes().filter((n) => n.metadata?.type === 'intersection');

  for (const business of businesses) {
    // Find nearest grid node
    let nearestNode = gridNodes[0];
    let minDistance = Infinity;

    for (const gridNode of gridNodes) {
      const dist = haversineDistance(
        business.latitude,
        business.longitude,
        gridNode.latitude,
        gridNode.longitude
      );
      if (dist < minDistance) {
        minDistance = dist;
        nearestNode = gridNode;
      }
    }

    // Add business node
    const businessNode: GraphNode = {
      id: `business-${business.id}`,
      latitude: business.latitude,
      longitude: business.longitude,
      metadata: {
        type: 'business',
        businessId: business.id,
        businessName: business.name,
      },
    };

    graph.addNode(businessNode);

    // Connect to nearest grid node with bidirectional edge
    const edge: GraphEdge = {
      id: `connector-business-${business.id}-${nearestNode.id}`,
      from: `business-${business.id}`,
      to: nearestNode.id,
      distanceKm: minDistance,
      roadType: 'connector',
      bidirectional: true,
      walkable: true,
      drivable: true,
    };

    graph.addEdge(edge);
  }
}

/**
 * Helper: Simple Haversine distance (inline, for loader use).
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  if (lat1 === lat2 && lon1 === lon2) return 0;

  const EARTH_RADIUS_KM = 6371.0088;
  const toRad = (deg: number) => (deg * Math.PI) / 180;

  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const distance = EARTH_RADIUS_KM * c;
  return distance;
}
