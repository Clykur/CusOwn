/**
 * Core graph data structures for road network routing.
 * Supports weighted directed/undirected graphs with spatial metadata.
 */

export interface GraphNode {
  id: string;
  latitude: number;
  longitude: number;
  /** Optional properties: name, intersection type, etc. */
  metadata?: Record<string, unknown>;
}

export interface GraphEdge {
  id: string;
  from: string; // node id
  to: string; // node id
  /** Distance in kilometers */
  distanceKm: number;
  /** Road type: residential, primary, secondary, etc. */
  roadType?: string;
  /** Is this edge bidirectional? If false, only from->to is valid. */
  bidirectional: boolean;
  /** Allow walking on this edge (default true) */
  walkable: boolean;
  /** Allow driving on this edge (default true) */
  drivable: boolean;
  metadata?: Record<string, unknown>;
}

export interface AdjacencyListEntry {
  nodeId: string;
  edge: GraphEdge;
}

export interface RouteSegment {
  fromNodeId: string;
  toNodeId: string;
  distanceKm: number;
  estimatedTimeMinutes: number;
  roadType?: string;
}

export interface RoutePath {
  startNodeId: string;
  endNodeId: string;
  totalDistanceKm: number;
  /** Total estimated time in minutes for the travel mode */
  totalTimeMinutes: number;
  segments: RouteSegment[];
  mode: 'walking' | 'driving';
}

/**
 * Weighted graph representation using adjacency list.
 * Optimized for sparse graphs and repeated shortest-path queries.
 */
export class WeightedGraph {
  private nodes: Map<string, GraphNode> = new Map();
  private adjacencyList: Map<string, AdjacencyListEntry[]> = new Map();
  private edgeIndex: Map<string, GraphEdge> = new Map();

  /**
   * Add a node to the graph.
   */
  addNode(node: GraphNode): void {
    if (this.nodes.has(node.id)) {
      console.warn(`Node ${node.id} already exists. Skipping.`);
      return;
    }
    this.nodes.set(node.id, node);
    if (!this.adjacencyList.has(node.id)) {
      this.adjacencyList.set(node.id, []);
    }
  }

  /**
   * Add an edge to the graph.
   * If bidirectional=true, adds both from->to and to->from.
   */
  addEdge(edge: GraphEdge): void {
    // Validate nodes exist
    if (!this.nodes.has(edge.from) || !this.nodes.has(edge.to)) {
      throw new Error(`Edge references non-existent node: ${edge.from} -> ${edge.to}`);
    }

    // Store edge by id for lookup
    if (this.edgeIndex.has(edge.id)) {
      console.warn(`Edge ${edge.id} already exists. Updating.`);
    }
    this.edgeIndex.set(edge.id, edge);

    // Add forward direction
    const adjFrom = this.adjacencyList.get(edge.from) || [];
    adjFrom.push({ nodeId: edge.to, edge });
    this.adjacencyList.set(edge.from, adjFrom);

    // Add reverse direction if bidirectional
    if (edge.bidirectional) {
      const reverseEdge: GraphEdge = {
        ...edge,
        id: `${edge.id}_reverse`,
        from: edge.to,
        to: edge.from,
      };

      const adjTo = this.adjacencyList.get(edge.to) || [];
      adjTo.push({ nodeId: edge.from, edge: reverseEdge });
      this.adjacencyList.set(edge.to, adjTo);
    }
  }

  /**
   * Get a node by id.
   */
  getNode(nodeId: string): GraphNode | undefined {
    return this.nodes.get(nodeId);
  }

  /**
   * Get neighbors of a node (outgoing edges).
   */
  getNeighbors(nodeId: string): AdjacencyListEntry[] {
    return this.adjacencyList.get(nodeId) || [];
  }

  /**
   * Get all nodes.
   */
  getAllNodes(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  /**
   * Get node count.
   */
  getNodeCount(): number {
    return this.nodes.size;
  }

  /**
   * Get edge count (including reverse edges if bidirectional).
   */
  getEdgeCount(): number {
    let count = 0;
    for (const neighbors of this.adjacencyList.values()) {
      count += neighbors.length;
    }
    return count;
  }

  /**
   * Check if a node exists.
   */
  hasNode(nodeId: string): boolean {
    return this.nodes.has(nodeId);
  }

  /**
   * Filter neighbors by travel mode (walking/driving).
   */
  getNeighborsByMode(nodeId: string, mode: 'walking' | 'driving'): AdjacencyListEntry[] {
    const neighbors = this.getNeighbors(nodeId);
    return neighbors.filter((entry) =>
      mode === 'walking' ? entry.edge.walkable : entry.edge.drivable
    );
  }
}
