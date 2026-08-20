import type { Direction } from "../../content/schemas/index";
import type { Walkable } from "./movement";

/**
 * Parses a Tiled `.tmj` into a core-side map model (research R-008).
 *
 * Layer names are contractual (contracts/asset-contract.md § 6). A missing one fails loudly and
 * by name, because the alternative — a map that renders with no collision — is a level the
 * player walks straight out of.
 */

export const REQUIRED_TILE_LAYERS = ["ground", "decoration", "collision", "above"] as const;
export const REQUIRED_OBJECT_LAYERS = ["spawns", "transitions"] as const;

export class MapParseError extends Error {
  constructor(mapId: string, detail: string) {
    super(`Map '${mapId}': ${detail}`);
    this.name = "MapParseError";
  }
}

export type Spawn =
  | { kind: "player-start"; x: number; y: number; facing: Direction }
  | { kind: "npc"; x: number; y: number; npcId: string; facing: Direction }
  | { kind: "monster"; x: number; y: number; monsterId: string; patrolRadius: number };

export interface Transition {
  x: number;
  y: number;
  targetMapId: string;
  targetX: number;
  targetY: number;
  facing: Direction;
}

export interface GameMap extends Walkable {
  id: string;
  width: number;
  height: number;
  tileWidth: number;
  tileHeight: number;
  spawns: Spawn[];
  transitions: Transition[];
  playerStart: Extract<Spawn, { kind: "player-start" }> | null;
  transitionAt(x: number, y: number): Transition | null;
}

interface RawProperty { name: string; value: unknown }
interface RawObject { type?: string; x: number; y: number; properties?: RawProperty[] }
interface RawLayer {
  name: string;
  type: string;
  data?: number[];
  objects?: RawObject[];
}
interface RawTileset {
  firstgid: number;
  tiles?: Array<{ id: number; properties?: RawProperty[] }>;
}
interface RawMap {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: RawLayer[];
  tilesets: RawTileset[];
}

function prop(object: RawObject, name: string): unknown {
  return object.properties?.find((p) => p.name === name)?.value;
}

function requireString(mapId: string, object: RawObject, name: string): string {
  const value = prop(object, name);
  if (typeof value !== "string" || value === "") {
    throw new MapParseError(mapId, `object at (${object.x},${object.y}) is missing string property '${name}'`);
  }
  return value;
}

function requireDirection(mapId: string, object: RawObject, name: string): Direction {
  const value = requireString(mapId, object, name);
  if (value !== "up" && value !== "down" && value !== "left" && value !== "right") {
    throw new MapParseError(mapId, `property '${name}' must be a direction, got '${value}'`);
  }
  return value;
}

function requireNumber(mapId: string, object: RawObject, name: string): number {
  const value = prop(object, name);
  const numeric = typeof value === "string" ? Number(value) : value;
  if (typeof numeric !== "number" || !Number.isFinite(numeric)) {
    throw new MapParseError(mapId, `object at (${object.x},${object.y}) is missing numeric property '${name}'`);
  }
  return numeric;
}

/** Global ids of every tile whose tileset marks it `collides` (asset contract § 5). */
function collidingGids(raw: RawMap): Set<number> {
  const gids = new Set<number>();
  for (const tileset of raw.tilesets) {
    for (const tile of tileset.tiles ?? []) {
      if (tile.properties?.some((p) => p.name === "collides" && p.value === true)) {
        gids.add(tileset.firstgid + tile.id);
      }
    }
  }
  return gids;
}

export function parseMap(mapId: string, raw: unknown): GameMap {
  const map = raw as RawMap;
  if (!map || !Array.isArray(map.layers) || !Array.isArray(map.tilesets)) {
    throw new MapParseError(mapId, "not a Tiled map document");
  }

  const byName = new Map(map.layers.map((layer) => [layer.name, layer]));

  for (const name of REQUIRED_TILE_LAYERS) {
    const layer = byName.get(name);
    if (!layer) throw new MapParseError(mapId, `missing required tile layer '${name}'`);
    if (layer.type !== "tilelayer") {
      throw new MapParseError(mapId, `layer '${name}' must be a tilelayer, got '${layer.type}'`);
    }
  }
  for (const name of REQUIRED_OBJECT_LAYERS) {
    const layer = byName.get(name);
    if (!layer) throw new MapParseError(mapId, `missing required object layer '${name}'`);
    if (layer.type !== "objectgroup") {
      throw new MapParseError(mapId, `layer '${name}' must be an objectgroup, got '${layer.type}'`);
    }
  }

  const solid = collidingGids(map);
  const blocked = new Uint8Array(map.width * map.height);

  // Two sources, unioned deliberately. The `collision` layer is how a designer blocks a specific
  // spot; the tileset's `collides` flag is how a tile stays solid WHEREVER it is placed. The
  // asset contract specifies both, so both are honoured.
  const collisionLayer = byName.get("collision");
  for (let i = 0; i < blocked.length; i += 1) {
    if ((collisionLayer?.data?.[i] ?? 0) !== 0) blocked[i] = 1;
  }
  for (const name of REQUIRED_TILE_LAYERS) {
    const data = byName.get(name)?.data;
    if (!data) continue;
    for (let i = 0; i < data.length; i += 1) {
      if (solid.has(data[i] ?? 0)) blocked[i] = 1;
    }
  }

  const toTile = (value: number, size: number) => Math.floor(value / size);

  const spawns: Spawn[] = (byName.get("spawns")?.objects ?? []).map((object) => {
    const x = toTile(object.x, map.tilewidth);
    const y = toTile(object.y, map.tileheight);
    switch (object.type) {
      case "player-start":
        return { kind: "player-start", x, y, facing: requireDirection(mapId, object, "facing") };
      case "npc":
        return { kind: "npc", x, y, npcId: requireString(mapId, object, "npcId"),
                 facing: requireDirection(mapId, object, "facing") };
      case "monster":
        return { kind: "monster", x, y, monsterId: requireString(mapId, object, "monsterId"),
                 patrolRadius: requireNumber(mapId, object, "patrolRadius") };
      default:
        throw new MapParseError(mapId, `unknown spawn type '${object.type ?? "(none)"}'`);
    }
  });

  const transitions: Transition[] = (byName.get("transitions")?.objects ?? []).map((object) => ({
    x: toTile(object.x, map.tilewidth),
    y: toTile(object.y, map.tileheight),
    targetMapId: requireString(mapId, object, "targetMapId"),
    targetX: requireNumber(mapId, object, "targetX"),
    targetY: requireNumber(mapId, object, "targetY"),
    facing: requireDirection(mapId, object, "facing"),
  }));

  const index = (x: number, y: number) => y * map.width + x;

  return {
    id: mapId,
    width: map.width,
    height: map.height,
    tileWidth: map.tilewidth,
    tileHeight: map.tileheight,
    spawns,
    transitions,
    playerStart: spawns.find((s): s is Extract<Spawn, { kind: "player-start" }> => s.kind === "player-start") ?? null,
    collidesAt: (x, y) => blocked[index(x, y)] === 1,
    transitionAt: (x, y) => transitions.find((t) => t.x === x && t.y === y) ?? null,
  };
}
