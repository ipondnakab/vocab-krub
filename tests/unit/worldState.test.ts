import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parseMap, type GameMap } from "../../src/core/world/mapData";
import { enterMap, monsterAt, movePlayer, removeMonster, stepPatrol } from "../../src/core/world/worldState";
import { generatePlaceholders } from "../../scripts/generate-placeholders.ts";
import { player, rng } from "../helpers/fixtures";
import type { PlayerState } from "../../src/core/player/playerState";

const OUT = join(process.cwd(), "public", "assets", "placeholder");
const maps = new Map<string, GameMap>();

beforeAll(() => {
  generatePlaceholders(OUT);
  for (const id of ["village", "forest", "cave"]) {
    maps.set(id, parseMap(id, JSON.parse(readFileSync(join(OUT, "maps", `${id}.tmj`), "utf8"))));
  }
});

const at = (x: number, y: number, over: Partial<PlayerState> = {}): PlayerState =>
  player({ location: { mapId: "forest", x, y, facing: "down" }, ...over });

describe("entering a map", () => {
  it("places monsters from the spawns layer", () => {
    const world = enterMap(maps.get("forest")!, player());
    expect(world.monsters.length).toBeGreaterThan(0);
    expect(world.monsters[0]).toMatchObject({ monsterId: "monster-eat" });
  });

  it("does NOT place a monster the player already defeated (FR-033)", () => {
    const world = enterMap(maps.get("forest")!, player({ monstersDefeated: ["monster-eat"] }));
    expect(world.monsters).toEqual([]);
  });

  it("places NPCs from the spawns layer", () => {
    expect(enterMap(maps.get("village")!, player()).npcs.length).toBeGreaterThan(0);
  });
});

describe("movement in the world", () => {
  it("moves onto a walkable tile", () => {
    const world = enterMap(maps.get("forest")!, player());
    const outcome = movePlayer(world, at(5, 7), "right");
    expect(outcome.kind).toBe("moved");
    if (outcome.kind === "moved") expect(outcome).toMatchObject({ x: 6, y: 7 });
  });

  it("is blocked by collision but still turns to face it", () => {
    const world = enterMap(maps.get("forest")!, player());
    const outcome = movePlayer(world, at(1, 1), "up");
    expect(outcome.kind).toBe("blocked");
    if (outcome.kind === "blocked") expect(outcome.facing).toBe("up");
  });

  it("treats an NPC as solid rather than walking through them", () => {
    const village = maps.get("village")!;
    const world = enterMap(village, player());
    const npc = world.npcs[0]!;
    const outcome = movePlayer(world, at(npc.x - 1, npc.y, { location: { mapId: "village", x: npc.x - 1, y: npc.y, facing: "right" } }), "right");
    expect(outcome.kind).toBe("blocked");
  });
});

describe("encounters (FR-032)", () => {
  it("starts an encounter when the player walks into a monster", () => {
    const world = enterMap(maps.get("forest")!, player());
    const monster = world.monsters[0]!;
    const outcome = movePlayer(world, at(monster.x - 1, monster.y), "right");
    expect(outcome.kind).toBe("encounter");
    if (outcome.kind === "encounter") expect(outcome.monsterId).toBe("monster-eat");
  });

  it("does NOT move the player onto the monster's tile", () => {
    const world = enterMap(maps.get("forest")!, player());
    const monster = world.monsters[0]!;
    const outcome = movePlayer(world, at(monster.x - 1, monster.y), "right");
    expect(outcome.kind).not.toBe("moved");
  });

  it("no longer encounters a monster that was removed after victory", () => {
    let world = enterMap(maps.get("forest")!, player());
    const monster = world.monsters[0]!;
    world = removeMonster(world, monster.monsterId);
    expect(monsterAt(world, monster.x, monster.y)).toBeNull();
    expect(movePlayer(world, at(monster.x - 1, monster.y), "right").kind).toBe("moved");
  });
});

describe("transitions (FR-031)", () => {
  it("reports a transition when the player steps onto one", () => {
    const forest = maps.get("forest")!;
    const world = enterMap(forest, player());
    const t = forest.transitions.find((x) => x.x === 0)!;
    const outcome = movePlayer(world, at(1, t.y), "left");
    expect(outcome.kind).toBe("transition");
    if (outcome.kind === "transition") {
      expect(outcome.transition.targetMapId).toBe("village");
      expect(outcome.world.pendingTransition).toBe(outcome.transition);
    }
  });
});

describe("patrol (FR-032 support)", () => {
  it("keeps a monster within its patrol radius over many steps", () => {
    let world = enterMap(maps.get("forest")!, player());
    const home = { ...world.monsters[0]! };
    const r = rng(11);
    for (let i = 0; i < 300; i += 1) world = stepPatrol(world, at(1, 1), r);
    const monster = world.monsters[0]!;
    expect(Math.abs(monster.x - home.homeX)).toBeLessThanOrEqual(home.patrolRadius);
    expect(Math.abs(monster.y - home.homeY)).toBeLessThanOrEqual(home.patrolRadius);
  });

  it("never walks a monster into a wall or off the map", () => {
    let world = enterMap(maps.get("forest")!, player());
    const r = rng(3);
    for (let i = 0; i < 300; i += 1) {
      world = stepPatrol(world, at(1, 1), r);
      for (const m of world.monsters) expect(world.map.collidesAt(m.x, m.y)).toBe(false);
    }
  });

  it("NEVER steps onto the player — encounters stay player-initiated", () => {
    // Principle I: the player is never ambushed into a question. They choose when to be tested.
    let world = enterMap(maps.get("forest")!, player());
    const start = world.monsters[0]!;
    const standing = at(start.x + 1, start.y);
    const r = rng(5);
    for (let i = 0; i < 400; i += 1) {
      world = stepPatrol(world, standing, r);
      for (const m of world.monsters) {
        expect(`${m.x},${m.y}`).not.toBe(`${standing.location.x},${standing.location.y}`);
      }
    }
  });

  it("leaves a stationary monster (patrolRadius 0) exactly where it spawned", () => {
    let world = enterMap(maps.get("cave")!, player());
    const home = { ...world.monsters[0]! };
    const r = rng(9);
    for (let i = 0; i < 100; i += 1) world = stepPatrol(world, at(1, 1), r);
    expect(world.monsters[0]).toMatchObject({ x: home.x, y: home.y });
  });

  it("never parks a monster on a map transition, which would block the exit", () => {
    let world = enterMap(maps.get("forest")!, player());
    const r = rng(7);
    for (let i = 0; i < 300; i += 1) {
      world = stepPatrol(world, at(1, 1), r);
      for (const m of world.monsters) expect(world.map.transitionAt(m.x, m.y)).toBeNull();
    }
  });
});
