/**
 * Spatial indexing (KD-tree) for fast nearest-node lookups.
 * Used to find the closest road network node to arbitrary GPS coordinates.
 */

import { GraphNode } from './graph-data-structures';

interface KDNode {
  point: GraphNode;
  left?: KDNode;
  right?: KDNode;
}

/**
 * Simple 2D KD-tree for spatial indexing of graph nodes.
 * Supports nearest-neighbor queries for finding closest nodes.
 */
export class KDTree {
  private root?: KDNode;
  private nodes: GraphNode[];

  constructor(nodes: GraphNode[] = []) {
    this.nodes = nodes;
    if (nodes.length > 0) {
      this.root = this.buildTree(nodes, 0);
    }
  }

  private buildTree(nodes: GraphNode[], depth: number): KDNode | undefined {
    if (nodes.length === 0) return undefined;

    // Alternate between latitude/longitude at each depth
    const axis = depth % 2; // 0 = latitude, 1 = longitude

    // Sort and find median
    const sorted = nodes.sort((a, b) => {
      const aVal = axis === 0 ? a.latitude : a.longitude;
      const bVal = axis === 0 ? b.latitude : b.longitude;
      return aVal - bVal;
    });

    const median = Math.floor(sorted.length / 2);

    return {
      point: sorted[median],
      left: this.buildTree(sorted.slice(0, median), depth + 1),
      right: this.buildTree(sorted.slice(median + 1), depth + 1),
    };
  }

  /**
   * Find nearest node to given coordinates.
   */
  findNearest(latitude: number, longitude: number): GraphNode | null {
    if (!this.root) return null;

    let best: { node: GraphNode; distance: number } = { node: null as any, distance: Infinity };

    const search = (node: KDNode | undefined, depth: number) => {
      if (!node) return;

      const dist = this.distance(node.point.latitude, node.point.longitude, latitude, longitude);

      if (!best || dist < best.distance) {
        best = { node: node.point, distance: dist };
      }

      const axis = depth % 2;
      const coord = axis === 0 ? latitude : longitude;
      const nodeCoord = axis === 0 ? node.point.latitude : node.point.longitude;

      const closeChild = coord < nodeCoord ? node.left : node.right;
      const farChild = coord < nodeCoord ? node.right : node.left;

      search(closeChild, depth + 1);

      // Check if we need to search the far side
      if (best && Math.abs(coord - nodeCoord) < best.distance) {
        search(farChild, depth + 1);
      }
    };

    search(this.root, 0);
    return best ? best.node : null;
  }

  /**
   * Find k nearest nodes.
   */
  findKNearest(latitude: number, longitude: number, k: number): GraphNode[] {
    if (!this.root) return [];

    const candidates: Array<{ node: GraphNode; distance: number }> = [];

    const search = (node: KDNode | undefined, depth: number) => {
      if (!node) return;

      const dist = this.distance(node.point.latitude, node.point.longitude, latitude, longitude);
      candidates.push({ node: node.point, distance: dist });

      // Simple approach: search both children
      if (node.left) search(node.left, depth + 1);
      if (node.right) search(node.right, depth + 1);
    };

    search(this.root, 0);

    // Sort by distance and return top k
    return candidates
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k)
      .map((c) => c.node);
  }

  /**
   * Find all nodes within radius (in km).
   */
  findWithinRadius(latitude: number, longitude: number, radiusKm: number): GraphNode[] {
    if (!this.root) return [];

    const result: GraphNode[] = [];

    const search = (node: KDNode | undefined) => {
      if (!node) return;

      const dist = this.distance(node.point.latitude, node.point.longitude, latitude, longitude);
      if (dist <= radiusKm) {
        result.push(node.point);
      }

      if (node.left) search(node.left);
      if (node.right) search(node.right);
    };

    search(this.root);
    return result;
  }

  /**
   * Euclidean distance in coordinate space (approximate, for searching).
   * Not meant to be geodesically accurate; just for spatial indexing.
   */
  private distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    // Rough approximation: 1 degree latitude ≈ 111 km, 1 degree longitude varies
    const latDiff = lat2 - lat1;
    const lonDiff = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));

    const latKm = latDiff * 111.32;
    const lonKm = lonDiff * 111.32;

    return Math.sqrt(latKm * latKm + lonKm * lonKm);
  }
}
