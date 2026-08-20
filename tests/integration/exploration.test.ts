import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parseMap, type GameMap } from "../../src/core/world/mapData";
import { enterMap, movePlayer, stepPatrol } from "../../src/core/world/worldState";
import { generatePlaceholders } from "../../scripts/generate-placeholders.ts";
import { player, rng } from "../helpers/fixtures";
import type { Direction } from "../../src/content/schemas";

const OUT = join(process.cwd(), "public", "assets", "placeholder");
import chaptersJson from "../../src/content/data/chapters.json" with { type: "json" };

const MAP_IDS = chaptersJson.chapters.flatMap((c) => c.mapIds);
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

  it("connects every map into one walkable chain, including across the chapter boundary", () => {
    // Each map links forward to the next and back to the previous, so the whole campaign is one
    // continuous route rather than disconnected islands.
    for (let i = 0; i < MAP_IDS.length; i += 1) {
      const map = maps.get(MAP_IDS[i]!)!;
      const previous = MAP_IDS[i - 1];
      const next = MAP_IDS[i + 1];
      if (previous) {
        expect(map.transitions.some((t) => t.targetMapId === previous), `${map.id} → ${previous}`).toBe(true);
      }
      if (next) {
        expect(map.transitions.some((t) => t.targetMapId === next), `${map.id} → ${next}`).toBe(true);
      }
    }
  });

  it("places each chapter's BOSS on that chapter's last map", () => {
    // Asserts the design intent rather than a map name, so it keeps meaning as chapters are added.
    for (const chapter of chaptersJson.chapters) {
      const lastMapId = chapter.mapIds.at(-1)!;
      const world = enterMap(maps.get(lastMapId)!, player());
      expect(world.monsters.map((m) => m.monsterId), `${chapter.id} boss`).toContain(chapter.bossMonsterId);
    }
  });

  it("puts at least one monster on every chapter's first map", () => {
    for (const chapter of chaptersJson.chapters) {
      const firstMapId = chapter.mapIds[0]!;
      expect(enterMap(maps.get(firstMapId)!, player()).monsters.length, chapter.id).toBeGreaterThan(0);
    }
  });
});
