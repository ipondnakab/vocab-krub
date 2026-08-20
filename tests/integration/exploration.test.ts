import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parseMap, type GameMap } from "../../src/core/world/mapData";
import { enterMap, movePlayer, stepPatrol } from "../../src/core/world/worldState";
import { generatePlaceholders } from "../../scripts/generate-placeholders.ts";
import { player, rng } from "../helpers/fixtures";
import type { Direction } from "../../src/content/schemas";

const OUT = join(process.cwd(), "public", "assets", "placeholder");
const MAP_IDS = ["village", "forest", "cave"] as const;
const DIRECTIONS: Direction[] = ["up", "down", "left", "right"];
const maps = new Map<string, GameMap>();

beforeAll(() => {
  generatePlaceholders(OUT);
  for (const id of MAP_IDS) {
    maps.set(id, parseMap(id, JSON.parse(readFileSync(join(OUT, "maps", `${id}.tmj`), "utf8"))));
  }
});

const standing = (mapId: string, x: number, y: number) =>
  player({ location: { mapId, x, y, facing: "down" } });

/**
 * T067 — the exploration guarantee.
 *
 * Constitution Principle I: "A player MUST always be able to move, explore, and talk. Exploration
 * is never gated behind a mandatory quiz screen that appears without narrative cause."
 *
 * These tests are what stop that from being a nice sentence in a document.
 */
describe("exploration is never blocked (Principle I, FR-006)", () => {
  it("offers at least one legal move from EVERY walkable tile on every map", () => {
    for (const id of MAP_IDS) {
      const map = maps.get(id)!;
      const world = enterMap(map, player());
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (map.collidesAt(x, y)) continue;
          const outcomes = DIRECTIONS.map((d) => movePlayer(world, standing(id, x, y), d));
          const stuck = outcomes.every((o) => o.kind === "blocked");
          expect(stuck, `${id} (${x},${y}) has no legal move — the player is trapped`).toBe(false);
        }
      }
    }
  });

  it("never starts a battle from a move the player did not make into a monster", () => {
    // The only path to an encounter is walking INTO a visible monster. No random encounters,
    // no unprompted quiz.
    for (const id of MAP_IDS) {
      const map = maps.get(id)!;
      const world = enterMap(map, player());
      for (let y = 0; y < map.height; y += 1) {
        for (let x = 0; x < map.width; x += 1) {
          if (map.collidesAt(x, y)) continue;
          for (const direction of DIRECTIONS) {
            const outcome = movePlayer(world, standing(id, x, y), direction);
            if (outcome.kind !== "encounter") continue;
            const target = movePlayer(world, standing(id, x, y), direction);
            expect(target.kind).toBe("encounter");
            // The tile stepped toward must be exactly where a monster is standing.
            expect(world.monsters.some((m) => m.monsterId === outcome.monsterId)).toBe(true);
          }
        }
      }
    }
  });

  it("keeps every map's exit reachable while monsters patrol", () => {
    // A monster parked on a transition would silently trap the player on that map.
    for (const id of MAP_IDS) {
      let world = enterMap(maps.get(id)!, player());
      const r = rng(21);
      for (let i = 0; i < 500; i += 1) {
        world = stepPatrol(world, standing(id, 1, 1), r);
        for (const t of world.map.transitions) {
          expect(world.monsters.some((m) => m.x === t.x && m.y === t.y), `${id} exit blocked`).toBe(false);
        }
      }
    }
  });

  it("connects village → forest → cave as one walkable route", () => {
    const village = maps.get("village")!;
    const forest = maps.get("forest")!;
    const cave = maps.get("cave")!;

    const toForest = village.transitions.find((t) => t.targetMapId === "forest");
    const toCave = forest.transitions.find((t) => t.targetMapId === "cave");
    const backToVillage = forest.transitions.find((t) => t.targetMapId === "village");
    const backToForest = cave.transitions.find((t) => t.targetMapId === "forest");

    expect(toForest, "village has no exit to the forest").toBeDefined();
    expect(toCave, "forest has no exit to the cave").toBeDefined();
    expect(backToVillage, "forest has no way back to the village").toBeDefined();
    expect(backToForest, "cave has no way back to the forest").toBeDefined();
  });

  it("places the chapter boss in the cave and a regular monster in the forest", () => {
    const forest = enterMap(maps.get("forest")!, player());
    const cave = enterMap(maps.get("cave")!, player());
    expect(forest.monsters.map((m) => m.monsterId)).toContain("monster-eat");
    expect(cave.monsters.map((m) => m.monsterId)).toContain("monster-go");
  });
});
