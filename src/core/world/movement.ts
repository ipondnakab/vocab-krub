import type { Direction } from "../../content/schemas/index";

/**
 * Grid movement and collision (FR-030).
 *
 * Pure functions over a tile grid, deliberately kept out of Phaser so collision is testable
 * without a renderer — including the one case that actually matters, which is that a blocked
 * move must leave the player exactly where they were rather than half inside a wall.
 */

export interface TilePosition {
  x: number;
  y: number;
}

export interface Walkable {
  width: number;
  height: number;
  /** True when the tile blocks movement. */
  collidesAt(x: number, y: number): boolean;
}

export const DIRECTION_DELTA: Record<Direction, TilePosition> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

export interface MoveResult {
  x: number;
  y: number;
  facing: Direction;
  /** False when the move was blocked — the player still TURNS to face the obstacle. */
  moved: boolean;
}

/**
 * Attempts one tile step.
 *
 * A blocked step still changes facing. That is how every JRPG behaves: you turn toward the wall
 * you walked into, which is also what makes "face an NPC to talk to them" feel natural rather
 * than fiddly.
 */
export function attemptMove(from: TilePosition, direction: Direction, map: Walkable): MoveResult {
  const delta = DIRECTION_DELTA[direction];
  const nextX = from.x + delta.x;
  const nextY = from.y + delta.y;

  if (!isInBounds(nextX, nextY, map) || map.collidesAt(nextX, nextY)) {
    return { x: from.x, y: from.y, facing: direction, moved: false };
  }
  return { x: nextX, y: nextY, facing: direction, moved: true };
}

export function isInBounds(x: number, y: number, map: Pick<Walkable, "width" | "height">): boolean {
  return x >= 0 && y >= 0 && x < map.width && y < map.height;
}

/** The tile the player is looking at — used for NPC interaction in US3. */
export function facingTile(from: TilePosition, facing: Direction): TilePosition {
  const delta = DIRECTION_DELTA[facing];
  return { x: from.x + delta.x, y: from.y + delta.y };
}

/**
 * Collapses simultaneous inputs to a single axis.
 *
 * Holding up+right on a tile grid is ambiguous; picking one axis is the classic answer and
 * avoids the player wedging themselves diagonally into a corner.
 */
export function resolveDirection(pressed: readonly Direction[]): Direction | null {
  if (pressed.length === 0) return null;
  // Vertical wins ties, matching the order players expect from RPG Maker-era games.
  return pressed.find((d) => d === "up" || d === "down") ?? pressed[0] ?? null;
}
