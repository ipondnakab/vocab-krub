import type { GameMap, Spawn, Transition } from "./mapData";
import { attemptMove, isInBounds, DIRECTION_DELTA } from "./movement";
import type { Direction } from "../../content/schemas/index";
import type { PlayerState } from "../player/playerState";
import type { Rng } from "../rng/rng";

/**
 * Live world state: who is standing where (FR-031 … FR-033).
 *
 * Kept in core rather than in the Phaser scene so contact, patrol bounds, and respawn rules are
 * testable without a renderer — and so the sprite the player sees can never disagree with the
 * tile the rules think a monster occupies.
 */

export interface MonsterEntity {
  monsterId: string;
  x: number;
  y: number;
  /** Patrol is bounded relative to the spawn tile, so a monster never wanders off its area. */
  homeX: number;
  homeY: number;
  patrolRadius: number;
}

export interface NpcEntity {
  npcId: string;
  x: number;
  y: number;
  facing: Direction;
}

export interface WorldState {
  map: GameMap;
  monsters: MonsterEntity[];
  npcs: NpcEntity[];
  /** Set when the player steps on a transition; the client loads the map and clears it. */
  pendingTransition: Transition | null;
}

function isMonster(spawn: Spawn): spawn is Extract<Spawn, { kind: "monster" }> {
  return spawn.kind === "monster";
}
function isNpc(spawn: Spawn): spawn is Extract<Spawn, { kind: "npc" }> {
  return spawn.kind === "npc";
}

/**
 * Builds world state for a map.
 *
 * FR-033: a monster the player has already defeated does not come back. Filtering at entry also
 * means it can never respawn under the player on return — it is simply not placed.
 */
export function enterMap(map: GameMap, player: PlayerState): WorldState {
  return {
    map,
    monsters: map.spawns
      .filter(isMonster)
      .filter((spawn) => !player.monstersDefeated.includes(spawn.monsterId))
      .map((spawn) => ({
        monsterId: spawn.monsterId,
        x: spawn.x,
        y: spawn.y,
        homeX: spawn.x,
        homeY: spawn.y,
        patrolRadius: spawn.patrolRadius,
      })),
    npcs: map.spawns.filter(isNpc).map((spawn) => ({ npcId: spawn.npcId, x: spawn.x, y: spawn.y, facing: spawn.facing })),
    pendingTransition: null,
  };
}

export function monsterAt(world: WorldState, x: number, y: number): MonsterEntity | null {
  return world.monsters.find((m) => m.x === x && m.y === y) ?? null;
}

export function npcAt(world: WorldState, x: number, y: number): NpcEntity | null {
  return world.npcs.find((n) => n.x === x && n.y === y) ?? null;
}

export type MoveOutcome =
  | { kind: "moved"; world: WorldState; x: number; y: number; facing: Direction }
  | { kind: "blocked"; world: WorldState; facing: Direction }
  /** Contact with a visible monster (FR-032). The player does not enter the tile. */
  | { kind: "encounter"; world: WorldState; monsterId: string; facing: Direction }
  | { kind: "transition"; world: WorldState; transition: Transition };

export function movePlayer(world: WorldState, player: PlayerState, direction: Direction): MoveOutcome {
  const from = { x: player.location.x, y: player.location.y };
  const delta = DIRECTION_DELTA[direction];
  const targetX = from.x + delta.x;
  const targetY = from.y + delta.y;

  // Checked before the collision test: a monster standing on a walkable tile is an encounter,
  // not an obstacle.
  if (isInBounds(targetX, targetY, world.map)) {
    const monster = monsterAt(world, targetX, targetY);
    if (monster) return { kind: "encounter", world, monsterId: monster.monsterId, facing: direction };
    if (npcAt(world, targetX, targetY)) return { kind: "blocked", world, facing: direction };
  }

  const result = attemptMove(from, direction, world.map);
  if (!result.moved) return { kind: "blocked", world, facing: direction };

  const transition = world.map.transitionAt(result.x, result.y);
  if (transition) {
    return { kind: "transition", world: { ...world, pendingTransition: transition }, transition };
  }

  return { kind: "moved", world, x: result.x, y: result.y, facing: result.facing };
}

/**
 * Advances monster patrol by one tile.
 *
 * Monsters never step onto the player. Encounters stay player-initiated, which is the whole
 * point of visible encounters: you are never ambushed into a question (Constitution Principle I).
 */
export function stepPatrol(world: WorldState, player: PlayerState, rng: Rng): WorldState {
  const monsters = world.monsters.map((monster) => {
    if (monster.patrolRadius <= 0) return monster;

    const direction = rng.pick(["up", "down", "left", "right"] as const);
    const delta = DIRECTION_DELTA[direction];
    const nextX = monster.x + delta.x;
    const nextY = monster.y + delta.y;

    const withinPatrol =
      Math.abs(nextX - monster.homeX) <= monster.patrolRadius &&
      Math.abs(nextY - monster.homeY) <= monster.patrolRadius;

    const free =
      isInBounds(nextX, nextY, world.map) &&
      !world.map.collidesAt(nextX, nextY) &&
      !(nextX === player.location.x && nextY === player.location.y) &&
      !world.monsters.some((other) => other !== monster && other.x === nextX && other.y === nextY) &&
      !world.npcs.some((npc) => npc.x === nextX && npc.y === nextY) &&
      world.map.transitionAt(nextX, nextY) === null;

    return withinPatrol && free ? { ...monster, x: nextX, y: nextY } : monster;
  });

  return { ...world, monsters };
}

/** FR-033: remove the restored word from the map for good. */
export function removeMonster(world: WorldState, monsterId: string): WorldState {
  return { ...world, monsters: world.monsters.filter((m) => m.monsterId !== monsterId) };
}
