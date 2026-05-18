import { GraphNode } from './graph-data-structures';

interface KDNode {
  point: GraphNode;
  left?: KDNode;
  right?: KDNode;
}

export class KDTree {
  private root?: KDNode;

  constructor(nodes: GraphNode[] = []) {
    if (nodes.length > 0) {
      this.root = this.buildTree(nodes, 0);
    }
  }

  private buildTree(nodes: GraphNode[], depth: number): KDNode | undefined {
    if (nodes.length === 0) return undefined;

    const axis = depth % 2;

    // FIX: avoid mutating input
    const sorted = [...nodes].sort((a, b) => {
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

  findNearest(latitude: number, longitude: number): GraphNode | null {
    if (!this.root) return null;

    let bestNode: GraphNode | null = null;
    let bestDistance = Infinity;

    const search = (node: KDNode | undefined, depth: number) => {
      if (!node) return;

      const dist = this.distance(node.point.latitude, node.point.longitude, latitude, longitude);

      if (dist < bestDistance) {
        bestDistance = dist;
        bestNode = node.point;
      }

      const axis = depth % 2;
      const coord = axis === 0 ? latitude : longitude;
      const nodeCoord = axis === 0 ? node.point.latitude : node.point.longitude;

      const closeChild = coord < nodeCoord ? node.left : node.right;
      const farChild = coord < nodeCoord ? node.right : node.left;

      search(closeChild, depth + 1);

      if (Math.abs(coord - nodeCoord) < bestDistance) {
        search(farChild, depth + 1);
      }
    };

    search(this.root, 0);
    return bestNode;
  }

  findKNearest(latitude: number, longitude: number, k: number): GraphNode[] {
    if (!this.root) return [];

    const candidates: Array<{ node: GraphNode; distance: number }> = [];

    const search = (node: KDNode | undefined) => {
      if (!node) return;

      const dist = this.distance(node.point.latitude, node.point.longitude, latitude, longitude);

      candidates.push({ node: node.point, distance: dist });

      search(node.left);
      search(node.right);
    };

    search(this.root);

    return candidates
      .sort((a, b) => a.distance - b.distance)
      .slice(0, k)
      .map((c) => c.node);
  }

  findWithinRadius(latitude: number, longitude: number, radiusKm: number): GraphNode[] {
    if (!this.root) return [];

    const result: GraphNode[] = [];

    const search = (node: KDNode | undefined) => {
      if (!node) return;

      const dist = this.distance(node.point.latitude, node.point.longitude, latitude, longitude);

      if (dist <= radiusKm) {
        result.push(node.point);
      }

      search(node.left);
      search(node.right);
    };

    search(this.root);
    return result;
  }

  private distance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const latDiff = lat2 - lat1;
    const lonDiff = (lon2 - lon1) * Math.cos(((lat1 + lat2) / 2) * (Math.PI / 180));

    const latKm = latDiff * 111.32;
    const lonKm = lonDiff * 111.32;

    return Math.sqrt(latKm * latKm + lonKm * lonKm);
  }
}
