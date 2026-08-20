import type { Direction, Localized } from "../../content/schemas/index";
import type { ContentIndex } from "../content/loadContent";
import { chapterOfMap } from "../chapter/progression";
import { hasCompletedLesson } from "../dialogue/dialogue";
import type { PlayerState } from "../player/playerState";
import type { GameMap } from "./mapData";
import type { WorldState } from "./worldState";

/**
 * Minimap and map-information derivation (contracts/minimap-model.md).
 *
 * The rule: core derives, React draws. No measurement, no layout, and no colour lives here; no
 * filtering or counting lives in the component. Everything below is a pure projection of state
 * already held by `GameMap`, `WorldState`, and `PlayerState` — nothing is persisted (FR-016).
 */

export interface MinimapTerrain {
  width: number;
  height: number;
  /** Row-major, length width * height. True where movement is blocked. */
  blocked: boolean[];
  exits: Array<{ x: number; y: number; targetMapId: string }>;
}

export interface MinimapMarkers {
  player: { x: number; y: number; facing: Direction };
  monsters: Array<{ x: number; y: number; monsterId: string }>;
  /**
   * `lesson` is `"none"` for an NPC with no `grammarTopicId` at all — most NPCs — rather than
   * collapsed into the same state as "outstanding". Collapsing it would mark every merchant and
   * villager as homework they are incapable of giving.
   */
  npcs: Array<{ x: number; y: number; npcId: string; lesson: "none" | "outstanding" | "done" }>;
  monstersRemaining: number;
  lessonsRemaining: number;
}

/** FR-014: shown when a map has no authored name. Never blank, never the raw id. */
const UNKNOWN_MAP_NAME: Localized = { th: "พื้นที่ไม่ทราบชื่อ", en: "Unknown Area" };

/**
 * Terrain only. Depends on the map, so callers should compute it once per map and memoize
 * (plan.md § Performance Goals) — this function itself does no caching.
 */
export function buildMinimapTerrain(map: GameMap): MinimapTerrain {
  const blocked: boolean[] = new Array(map.width * map.height);
  for (let y = 0; y < map.height; y += 1) {
    for (let x = 0; x < map.width; x += 1) {
      blocked[y * map.width + x] = map.collidesAt(x, y);
    }
  }
  return {
    width: map.width,
    height: map.height,
    blocked,
    exits: map.transitions.map((t) => ({ x: t.x, y: t.y, targetMapId: t.targetMapId })),
  };
}

/** Live markers and counts. Cheap; recompute whenever world state changes. */
export function buildMinimapMarkers(
  world: WorldState,
  player: PlayerState,
  content: ContentIndex,
): MinimapMarkers {
  // `enterMap` has already removed defeated monsters, so no second filter is needed here.
  const monsters = world.monsters.map((m) => ({ x: m.x, y: m.y, monsterId: m.monsterId }));

  const npcs = world.npcs.map((entity) => {
    const npc = content.npc(entity.npcId);
    const lesson: MinimapMarkers["npcs"][number]["lesson"] =
      npc.grammarTopicId === null
        ? "none"
        : hasCompletedLesson(entity.npcId, player, content)
          ? "done"
          : "outstanding";
    return { x: entity.x, y: entity.y, npcId: entity.npcId, lesson };
  });

  return {
    player: { x: player.location.x, y: player.location.y, facing: player.location.facing },
    monsters,
    npcs,
    monstersRemaining: monsters.length,
    lessonsRemaining: npcs.filter((n) => n.lesson === "outstanding").length,
  };
}

/** The map's authored name, or a readable fallback (FR-014). Never an empty string or a raw id. */
export function mapDisplayName(mapId: string, content: ContentIndex): Localized {
  const chapter = chapterOfMap(mapId, content);
  return chapter?.mapNames[mapId] ?? UNKNOWN_MAP_NAME;
}
