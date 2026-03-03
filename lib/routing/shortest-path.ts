/**
 * Shortest-path routing algorithms: Dijkstra's and A*.
 * Used to compute accurate travel times based on road networks.
 */

import { WeightedGraph, RoutePath, RouteSegment, GraphNode } from './graph-data-structures';
import { haversineDistance } from '../utils/geo';

interface DijkstraState {
  distance: Map<string, number>;
  previous: Map<string, string | null>;
  unvisited: Set<string>;
}

/**
 * Dijkstra's shortest path algorithm.
 * Computes the shortest path from start to end node.
 * Returns the total distance in km.
 */
export function dijkstra(
  graph: WeightedGraph,
  startNodeId: string,
  endNodeId: string,
  mode: 'walking' | 'driving' = 'walking'
): { distances: Map<string, number>; previous: Map<string, string | null> } {
  const state: DijkstraState = {
    distance: new Map(),
    previous: new Map(),
    unvisited: new Set(),
  };

  // Initialize
  for (const node of graph.getAllNodes()) {
    state.distance.set(node.id, node.id === startNodeId ? 0 : Infinity);
    state.previous.set(node.id, null);
    state.unvisited.add(node.id);
  }

  while (state.unvisited.size > 0) {
    // Find unvisited node with smallest distance
    let current: string | null = null;
    let minDist = Infinity;

    for (const nodeId of state.unvisited) {
      const dist = state.distance.get(nodeId) ?? Infinity;
      if (dist < minDist) {
        minDist = dist;
        current = nodeId;
      }
    }

    if (current === null || minDist === Infinity) {
      break; // No more reachable nodes
    }

    state.unvisited.delete(current);

    // Relax edges
    const neighbors = graph.getNeighborsByMode(current, mode);
    for (const { nodeId: neighbor, edge } of neighbors) {
      if (state.unvisited.has(neighbor)) {
        const alt = (state.distance.get(current) ?? Infinity) + edge.distanceKm;
        const neighborDist = state.distance.get(neighbor) ?? Infinity;
        if (alt < neighborDist) {
          state.distance.set(neighbor, alt);
          state.previous.set(neighbor, current);
        }
      }
    }
  }

  return { distances: state.distance, previous: state.previous };
}

/**
 * Reconstruct path from Dijkstra result.
 */
export function reconstructPath(previous: Map<string, string | null>, endNodeId: string): string[] {
  const path: string[] = [];
  let current: string | null = endNodeId;

  while (current !== null) {
    path.unshift(current);
    current = previous.get(current) ?? null;
  }

  return path;
}

/**
 * A* algorithm with Haversine heuristic.
 * More efficient than Dijkstra for long routes.
 */
export function aStar(
  graph: WeightedGraph,
  startNodeId: string,
  endNodeId: string,
  mode: 'walking' | 'driving' = 'walking'
): { distances: Map<string, number>; previous: Map<string, string | null> } {
  const endNode = graph.getNode(endNodeId);
  if (!endNode) {
    throw new Error(`End node not found: ${endNodeId}`);
  }

  const gScore = new Map<string, number>(); // Cost from start
  const fScore = new Map<string, number>(); // g + heuristic cost
  const previous = new Map<string, string | null>();
  const visited = new Set<string>();
  const openSet = new Set<string>();

  // Initialize
  for (const node of graph.getAllNodes()) {
    gScore.set(node.id, Infinity);
    fScore.set(node.id, Infinity);
  }

  gScore.set(startNodeId, 0);
  const startNode = graph.getNode(startNodeId);
  if (!startNode) throw new Error(`Start node not found: ${startNodeId}`);

  const heuristic = haversineDistance(
    startNode.latitude,
    startNode.longitude,
    endNode.latitude,
    endNode.longitude
  );
  fScore.set(startNodeId, heuristic);
  openSet.add(startNodeId);

  while (openSet.size > 0) {
    // Find node in openSet with lowest fScore
    let current: string | null = null;
    let minFScore = Infinity;

    for (const nodeId of openSet) {
      const f = fScore.get(nodeId) ?? Infinity;
      if (f < minFScore) {
        minFScore = f;
        current = nodeId;
      }
    }

    if (current === null) break;

    if (current === endNodeId) {
      // Path found; reconstruct
      return { distances: gScore, previous };
    }

    openSet.delete(current);
    visited.add(current);

    const neighbors = graph.getNeighborsByMode(current, mode);
    for (const { nodeId: neighbor, edge } of neighbors) {
      if (visited.has(neighbor)) continue;

      const tentativeGScore = (gScore.get(current) ?? Infinity) + edge.distanceKm;
      const currentG = gScore.get(neighbor) ?? Infinity;

      if (tentativeGScore < currentG) {
        previous.set(neighbor, current);
        gScore.set(neighbor, tentativeGScore);

        const neighborNode = graph.getNode(neighbor);
        if (neighborNode) {
          const h = haversineDistance(
            neighborNode.latitude,
            neighborNode.longitude,
            endNode.latitude,
            endNode.longitude
          );
          fScore.set(neighbor, tentativeGScore + h);
        }

        if (!openSet.has(neighbor)) {
          openSet.add(neighbor);
        }
      }
    }
  }

  // No path found; return final state
  return { distances: gScore, previous };
}

/**
 * Compute travel time given distance and travel mode.
 * Uses configurable speeds for walking/driving.
 */
export function computeTravelTime(
  distanceKm: number,
  mode: 'walking' | 'driving',
  roadType?: string,
  speedOverrideKmH?: number
): number {
  // Speeds by road type (km/h)
  const speeds: Record<string, { walking: number; driving: number }> = {
    footway: { walking: 4.5, driving: 0.5 },
    pedestrian: { walking: 5, driving: 1 },
    residential: { walking: 4.5, driving: 30 },
    secondary: { walking: 4.5, driving: 50 },
    primary: { walking: 4.5, driving: 60 },
    motorway: { walking: 4.5, driving: 100 },
    service: { walking: 4.5, driving: 20 },
    unknown: { walking: 4.5, driving: 50 },
  };

  // default global speeds
  const defaultSpeeds: Record<string, number> = {
    walking: 4.5,
    driving: 50,
  };

  let speed: number;
  if (speedOverrideKmH !== undefined) {
    speed = speedOverrideKmH;
  } else if (roadType && speeds[roadType]) {
    speed = speeds[roadType][mode];
  } else {
    speed = defaultSpeeds[mode];
  }

  const hours = distanceKm / speed;
  const minutes = hours * 60;
  return minutes;
}

/**
 * Compute full route with segments and timing.
 */
export function computeRoute(
  graph: WeightedGraph,
  startNodeId: string,
  endNodeId: string,
  mode: 'walking' | 'driving' = 'walking',
  useAStar: boolean = true
): RoutePath | null {
  const { distances, previous } = useAStar
    ? aStar(graph, startNodeId, endNodeId, mode)
    : dijkstra(graph, startNodeId, endNodeId, mode);

  const distance = distances.get(endNodeId);
  if (distance === undefined || distance === Infinity) {
    return null; // No path found
  }

  const path = reconstructPath(previous, endNodeId);
  if (path.length < 2) {
    return null;
  }

  const segments: RouteSegment[] = [];
  let totalDistance = 0;
  let totalTime = 0;

  for (let i = 0; i < path.length - 1; i++) {
    const fromNodeId = path[i];
    const toNodeId = path[i + 1];
    const fromNode = graph.getNode(fromNodeId);
    const toNode = graph.getNode(toNodeId);

    if (!fromNode || !toNode) continue;

    // Find edge
    let edgeDistance = haversineDistance(
      fromNode.latitude,
      fromNode.longitude,
      toNode.latitude,
      toNode.longitude
    );

    const neighbors = graph.getNeighborsByMode(fromNodeId, mode);
    let roadType = 'unknown';
    for (const { edge } of neighbors) {
      if (edge.to === toNodeId) {
        edgeDistance = edge.distanceKm;
        roadType = edge.roadType || 'unknown';
        break;
      }
    }

    const segmentTime = computeTravelTime(edgeDistance, mode, roadType);
    segments.push({
      fromNodeId,
      toNodeId,
      distanceKm: edgeDistance,
      estimatedTimeMinutes: segmentTime,
      roadType,
    });

    totalDistance += edgeDistance;
    totalTime += segmentTime;
  }

  return {
    startNodeId,
    endNodeId,
    totalDistanceKm: totalDistance,
    totalTimeMinutes: totalTime,
    segments,
    mode,
  };
}
