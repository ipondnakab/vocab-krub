import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parseMap, type GameMap } from "../../src/core/world/mapData";
import { enterMap, stepPatrol, type WorldState } from "../../src/core/world/worldState";
import {
  buildMinimapMarkers, buildMinimapTerrain, mapDisplayName,
} from "../../src/core/world/minimap";
import { generatePlaceholders } from "../../scripts/generate-placeholders.ts";
import { content, player, rng } from "../helpers/fixtures";

const OUT = join(process.cwd(), "public", "assets", "placeholder");
const maps = new Map<string, GameMap>();

beforeAll(() => {
  generatePlaceholders(OUT);
  for (const id of ["village", "forest", "cave", "castle", "river", "ruins"]) {
    maps.set(id, parseMap(id, JSON.parse(readFileSync(join(OUT, "maps", `${id}.tmj`), "utf8"))));
  }
});

describe("buildMinimapTerrain (FR-001, FR-003, FR-004, FR-007)", () => {
  it("produces a row-major blocked array of length width * height, matching collidesAt", () => {
    const map = maps.get("forest")!;
    const terrain = buildMinimapTerrain(map);
    expect(terrain.width).toBe(map.width);
    expect(terrain.height).toBe(map.height);
    expect(terrain.blocked.length).toBe(map.width * map.height);
    for (let y = 0; y < map.height; y += 1) {
      for (let x = 0; x < map.width; x += 1) {
        expect(terrain.blocked[y * map.width + x]).toBe(map.collidesAt(x, y));
      }
    }
  });

  it("marks every map transition in exits, at its correct tile position", () => {
    const map = maps.get("village")!;
    const terrain = buildMinimapTerrain(map);
    expect(terrain.exits.length).toBe(map.transitions.length);
    for (const transition of map.transitions) {
      expect(terrain.exits).toContainEqual({
        x: transition.x, y: transition.y, targetMapId: transition.targetMapId,
      });
    }
  });

  it("derives terrain per map, so two different maps never produce equal models (stale-map failure mode)", () => {
    const village = buildMinimapTerrain(maps.get("village")!);
    const forest = buildMinimapTerrain(maps.get("forest")!);
    expect(village).not.toEqual(forest);
  });

  it("produces valid, empty-safe markers for a map with no monsters and no NPCs (FR-007)", () => {
    const empty: WorldState = { map: maps.get("village")!, monsters: [], npcs: [], pendingTransition: null };
    const markers = buildMinimapMarkers(empty, player(), content);
    expect(markers.monsters).toEqual([]);
    expect(markers.npcs).toEqual([]);
    expect(markers.monstersRemaining).toBe(0);
    expect(markers.lessonsRemaining).toBe(0);
  });
});

describe("buildMinimapMarkers — monsters and NPCs (FR-008, FR-009, FR-010, FR-011, FR-012)", () => {
  it("includes every monster in world state, and a defeated one is simply absent (no second filter needed)", () => {
    const world = enterMap(maps.get("forest")!, player());
    const markers = buildMinimapMarkers(world, player(), content);
    expect(markers.monsters.map((m) => m.monsterId).sort()).toEqual(
      world.monsters.map((m) => m.monsterId).sort(),
    );

    const defeatedId = world.monsters[0]!.monsterId;
    const afterDefeat = enterMap(maps.get("forest")!, player({ monstersDefeated: [defeatedId] }));
    const markersAfter = buildMinimapMarkers(afterDefeat, player({ monstersDefeated: [defeatedId] }), content);
    expect(markersAfter.monsters.some((m) => m.monsterId === defeatedId)).toBe(false);
  });

  it("moves a monster's marker position after stepPatrol", () => {
    const patroller = maps.get("forest")!;
    let world = enterMap(patroller, player());
    // A few ticks give the patrol RNG room to actually move something.
    for (let i = 0; i < 10; i += 1) world = stepPatrol(world, player(), rng(i));
    const before = buildMinimapMarkers(enterMap(patroller, player()), player(), content).monsters;
    const after = buildMinimapMarkers(world, player(), content).monsters;
    expect(after.map((m) => ({ x: m.x, y: m.y }))).not.toEqual(before.map((m) => ({ x: m.x, y: m.y })));
  });

  it("marks 'none' for an NPC with no grammarTopicId, distinct from outstanding or done", () => {
    const world = enterMap(maps.get("village")!, player());
    const markers = buildMinimapMarkers(world, player({ grammarLearned: [] }), content);
    const noLesson = markers.npcs.find((n) => n.npcId === "guard-thanet");
    expect(noLesson?.lesson).toBe("none");
  });

  it("marks 'outstanding' for an NPC with an unlearned lesson, and 'done' once it is learned", () => {
    const world = enterMap(maps.get("village")!, player());

    const notYet = buildMinimapMarkers(world, player({ grammarLearned: [] }), content);
    expect(notYet.npcs.find((n) => n.npcId === "teacher-mali")?.lesson).toBe("outstanding");

    const done = buildMinimapMarkers(world, player({ grammarLearned: ["present-simple"] }), content);
    expect(done.npcs.find((n) => n.npcId === "teacher-mali")?.lesson).toBe("done");
  });

  it("counts monstersRemaining and lessonsRemaining accurately, excluding NPCs with no lesson, and both zero on a finished map", () => {
    const world = enterMap(maps.get("village")!, player());
    const npcsHere = world.npcs.map((n) => n.npcId);
    const outstandingByContent = npcsHere.filter((id) => {
      const npc = content.npc(id);
      return npc.grammarTopicId !== null;
    });

    const fresh = buildMinimapMarkers(world, player({ grammarLearned: [] }), content);
    expect(fresh.monstersRemaining).toBe(world.monsters.length);
    expect(fresh.lessonsRemaining).toBe(outstandingByContent.length);

    // Learn every topic taught here and defeat every monster here: both counts drop to zero.
    const learnedAll = outstandingByContent.map((id) => content.npc(id).grammarTopicId!);
    const clearedWorld = enterMap(
      maps.get("village")!,
      player({ monstersDefeated: world.monsters.map((m) => m.monsterId) }),
    );
    const cleared = buildMinimapMarkers(clearedWorld, player({ grammarLearned: learnedAll }), content);
    expect(cleared.monstersRemaining).toBe(0);
    expect(cleared.lessonsRemaining).toBe(0);
  });
});

describe("mapDisplayName (FR-013, FR-014, FR-015)", () => {
  it("returns the authored name for a real map, in both locales", () => {
    const name = mapDisplayName("village", content);
    expect(name.th.length).toBeGreaterThan(0);
    expect(name.en.length).toBeGreaterThan(0);
  });

  it("falls back to something readable — never blank, never the raw id — for an unknown map", () => {
    const name = mapDisplayName("does-not-exist", content);
    expect(name.th).not.toBe("");
    expect(name.en).not.toBe("");
    expect(name.th).not.toBe("does-not-exist");
    expect(name.en).not.toBe("does-not-exist");
  });
});
