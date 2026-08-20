# Contract: Minimap Model

The shape `src/core/world/minimap.ts` produces and `src/components/hud/Minimap.tsx` consumes.

**The rule**: core derives, React draws. No measurement, no layout, and no colour lives in core;
no filtering or counting lives in the component.

---

## Core API

```ts
/** Terrain only. Depends on the map, so it is computed once per map and memoized. */
buildMinimapTerrain(map: GameMap): MinimapTerrain

/** Live markers and counts. Cheap; recomputed whenever world state changes. */
buildMinimapMarkers(
  world: WorldState,
  player: PlayerState,
  content: ContentIndex,
): MinimapMarkers

/** The map's authored name, or a readable fallback (FR-014). */
mapDisplayName(mapId: string, content: ContentIndex): Localized
```

## Types

```ts
interface MinimapTerrain {
  width: number;
  height: number;
  /** Row-major, length width * height. True where movement is blocked. */
  blocked: boolean[];
  exits: Array<{ x: number; y: number; targetMapId: string }>;
}

interface MinimapMarkers {
  player: { x: number; y: number; facing: Direction };
  monsters: Array<{ x: number; y: number; monsterId: string }>;
  npcs: Array<{ x: number; y: number; npcId: string; lessonDone: boolean }>;
  monstersRemaining: number;
  lessonsRemaining: number;
}
```

## Rules

- **Nothing is persisted.** Both functions are pure and derive from state already in the store
  (FR-016).
- `monsters` contains only monsters still present — `enterMap` has already removed defeated ones,
  so no second filter is needed and adding one would risk the two disagreeing.
- `npcs` marks lessons done rather than omitting them: an NPC you have finished with still exists
  and is still worth locating (FR-011).
- `blocked` is row-major and indexed `y * width + x`, matching how the map's collision grid is
  already stored.
- `mapDisplayName` never returns an empty string or a raw id (FR-014).

## Rendering contract

- Inline SVG sized from `width` and `height` so proportions hold (FR-005, R-305).
- Rendered only while `screen === "world"` (R-304, FR-006) — the same rule `WorldHud` follows.
- Player, monster, and NPC markers must be distinguishable without colour alone, since colour is
  the first thing to fail on a small pixel-art palette.
- No text inside the SVG. Map name and counts are rendered as DOM text beside it, so Thai renders
  through the DOM like every other string (research R-014 of feature 001).

## What this contract forbids

- Reading anything back out of Phaser. The minimap is drawn from store state, not from the scene
  graph — that is the whole reason R-301 chose React.
- Any core function that knows a pixel size, a colour, or a viewport.
- A second source of truth for "which monsters are here".
