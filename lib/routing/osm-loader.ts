/**
 * OpenStreetMap data loader.
 *
 * This module provides utilities to ingest .pbf OSM data and convert it into our
 * internal WeightedGraph format.  The parser is intentionally lightweight and
 * only extracts the elements we care about:
 *   - nodes with latitude/longitude
 *   - ways tagged as highways / footways / pedestrian etc.
 *
 * You can download regional extracts from Geofabrik (see GEO_OSM_DOWNLOAD_REF in config) or
 * use `osmconvert`/`osmfilter` to trim the dataset.
 *
 * Depending on your environment you may use a native parser library such as
 * `osm-pbf-parser`, `node-osm-pbf`, or shell out to `osmium`/`osmtogeojson`
 * and read the resulting JSON stream.  Below is a simple implementation example
 * using the `osm-pbf-parser` npm package, but you can swap in a different
 * reader as needed.
 */

import fs from 'fs';
import { WeightedGraph, GraphNode, GraphEdge } from './graph-data-structures';
import { haversineDistance } from '../utils/geo';

// optional dependency; add to package.json if you plan on using it
// import { Parser } from 'osm-pbf-parser';

interface OsmNode {
  id: number;
  lat: number;
  lon: number;
}

interface OsmWay {
  id: number;
  nodes: number[];
  tags: Record<string, string>;
}

/**
 * Load a WeightedGraph directly from a .pbf file.
 * This operation reads the entire file into memory so it may take a few
 * seconds for large extracts.  You can optimize by filtering beforehand.
 */
export async function loadGraphFromOsmPbf(path: string): Promise<WeightedGraph> {
  const graph = new WeightedGraph();

  // maps for quick lookup
  const nodesMap: Map<number, OsmNode> = new Map();

  // try to load a parser dynamically; do not hard‑depend on any particular
  // package so that the core library remains lightweight.  The caller must
  // install a parser such as `osm-pbf-parser` or `node-osm-pbf` in production.
  type ParserConstructor = new () => NodeJS.WritableStream & {
    on(event: string, fn: (...args: unknown[]) => void): unknown;
  };
  let Parser: ParserConstructor;
  try {
    // Optional dependency; not in package.json. webpackIgnore prevents build-time resolution.
    // @ts-expect-error optional dependency
    const mod = await import(/* webpackIgnore: true */ 'osm-pbf-parser');
    Parser = (mod.Parser ?? mod.default ?? mod) as ParserConstructor;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(
      'Unable to load OSM PBF parser.\n' +
        'Please install a compatible package (e.g. `npm install osm-pbf-parser`).\n' +
        `Original error: ${msg}`
    );
  }

  return new Promise<WeightedGraph>((resolve, reject) => {
    const parser = new Parser();
    const stream = fs.createReadStream(path);
    stream.pipe(parser as NodeJS.WritableStream);

    parser.on('data', (item: any) => {
      if (!item || typeof item !== 'object') return;
      switch (item.type) {
        case 'node':
          nodesMap.set(item.id, { id: item.id, lat: item.lat, lon: item.lon });
          break;
        case 'way': {
          const tags: Record<string, string> = item.tags || {};
          if (tags.highway || tags.footway || tags.pedestrian) {
            processWay(item.id, item.nodes, tags, nodesMap, graph);
          }
          break;
        }
        default:
          // ignore other element types
          break;
      }
    });

    parser.on('end', () => resolve(graph));
    parser.on('error', (err: any) => reject(err));
  });
}

/**
 * Example helper that converts an OSM way into graph edges.
 * This is called for each way that represents a routable segment.
 */
function processWay(
  id: number,
  nodeIds: number[],
  tags: Record<string, string>,
  nodesMap: Map<number, OsmNode>,
  graph: WeightedGraph
) {
  // determine road type and directional/oneway
  const roadType = tags.highway || tags.footway || tags.pedestrian || 'unknown';
  const oneway = tags.oneway === 'yes' || tags.oneway === 'true';
  const walkable = roadType !== 'motorway' && roadType !== 'trunk';
  const drivable = roadType !== 'footway' && roadType !== 'pedestrian';

  for (let i = 0; i < nodeIds.length - 1; i++) {
    const a = nodesMap.get(nodeIds[i]);
    const b = nodesMap.get(nodeIds[i + 1]);
    if (!a || !b) continue;

    const fromId = `osm-${a.id}`;
    const toId = `osm-${b.id}`;

    // ensure nodes exist in graph
    graph.addNode({ id: fromId, latitude: a.lat, longitude: a.lon });
    graph.addNode({ id: toId, latitude: b.lat, longitude: b.lon });

    const distanceKm = haversineDistance(a.lat, a.lon, b.lat, b.lon);

    const edge: GraphEdge = {
      id: `way-${id}-${i}`,
      from: fromId,
      to: toId,
      distanceKm,
      roadType,
      bidirectional: !oneway,
      walkable,
      drivable,
    };
    graph.addEdge(edge);

    if (!oneway) {
      // reverse fixed automatically by addEdge when bidirectional=true
    }
  }
}
