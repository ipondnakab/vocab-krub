import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { MapParseError, parseMap, type GameMap } from "../../src/core/world/mapData";
import { generatePlaceholders } from "../../scripts/generate-placeholders.ts";
import { content } from "../helpers/fixtures";

const OUT = join(process.cwd(), "public", "assets", "placeholder");
const MAP_IDS = ["village", "forest", "cave"] as const;

const rawMap = (id: string) => JSON.parse(readFileSync(join(OUT, "maps", `${id}.tmj`), "utf8")) as unknown;
const maps = new Map<string, GameMap>();

beforeAll(() => {
  generatePlaceholders(OUT);
  for (const id of MAP_IDS) maps.set(id, parseMap(id, rawMap(id)));
});

describe("map parsing", () => {
  it("parses all three chapter maps", () => {
    for (const id of MAP_IDS) {
      const map = maps.get(id)!;
      expect(map.id).toBe(id);
      expect(map.width).toBeGreaterThan(0);
      expect(map.tileWidth).toBe(32);
    }
  });

  it("fails by NAME when a required layer is missing", () => {
    const raw = rawMap("village") as { layers: Array<{ name: string }> };
    const without = { ...raw, layers: raw.layers.filter((l) => l.name !== "collision") };
    expect(() => parseMap("village", without)).toThrow(MapParseError);
    expect(() => parseMap("village", without)).toThrow(/missing required tile layer 'collision'/);
  });

  it("fails when a required layer has the wrong type", () => {
    const raw = rawMap("village") as { layers: Array<{ name: string; type: string }> };
    const wrong = {
      ...raw,
      layers: raw.layers.map((l) => (l.name === "spawns" ? { ...l, type: "tilelayer" } : l)),
    };
    expect(() => parseMap("village", wrong)).toThrow(/must be an objectgroup/);
  });

  it("rejects an unknown spawn type rather than ignoring it", () => {
    const raw = rawMap("village") as { layers: Array<{ name: string; objects?: unknown[] }> };
    const bad = {
      ...raw,
      layers: raw.layers.map((l) =>
        l.name === "spawns" ? { ...l, objects: [{ type: "wizard", x: 0, y: 0, properties: [] }] } : l,
      ),
    };
    expect(() => parseMap("village", bad)).toThrow(/unknown spawn type 'wizard'/);
  });

  it("rejects a spawn missing its required property", () => {
    const raw = rawMap("village") as { layers: Array<{ name: string; objects?: unknown[] }> };
    const bad = {
      ...raw,
      layers: raw.layers.map((l) =>
        l.name === "spawns" ? { ...l, objects: [{ type: "npc", x: 0, y: 0, properties: [] }] } : l,
      ),
    };
    expect(() => parseMap("village", bad)).toThrow(/missing string property 'npcId'/);
  });
});

describe("collision", () => {
  it("blocks the map border", () => {
    const village = maps.get("village")!;
    expect(village.collidesAt(0, 0)).toBe(true);
    expect(village.collidesAt(village.width - 1, 0)).toBe(true);
  });

  it("leaves the walkable route open", () => {
    for (const id of MAP_IDS) {
      const map = maps.get(id)!;
      // The generated path runs across row 7.
      expect(map.collidesAt(Math.floor(map.width / 2), 7), id).toBe(false);
    }
  });

  it("unions the collision layer with tiles the tileset marks solid", () => {
    // Both sources are specified by the asset contract; honouring only one would let a designer
    // place a tree that the player walks straight through.
    const village = maps.get("village")!;
    expect(village.collidesAt(5, 4)).toBe(true); // interior obstacle from the generator
  });
});

describe("spawns", () => {
  it("gives the village a single player start", () => {
    const starts = maps.get("village")!.spawns.filter((s) => s.kind === "player-start");
    expect(starts).toHaveLength(1);
    expect(maps.get("village")!.playerStart).not.toBeNull();
  });

  it("never places the player start or an npc on a colliding tile", () => {
    for (const id of MAP_IDS) {
      const map = maps.get(id)!;
      for (const spawn of map.spawns) {
        expect(map.collidesAt(spawn.x, spawn.y), `${id} ${spawn.kind} at ${spawn.x},${spawn.y}`).toBe(false);
      }
    }
  });

  it("references only real npc and monster ids", () => {
    for (const id of MAP_IDS) {
      for (const spawn of maps.get(id)!.spawns) {
        if (spawn.kind === "npc") expect(() => content.npc(spawn.npcId)).not.toThrow();
        if (spawn.kind === "monster") expect(() => content.monster(spawn.monsterId)).not.toThrow();
      }
    }
  });
});

describe("transitions", () => {
  it("gives every transition a counterpart in its destination map", () => {
    // The stranded-player edge case: a one-way link is a map you enter and cannot leave.
    for (const id of MAP_IDS) {
      for (const transition of maps.get(id)!.transitions) {
        const target = maps.get(transition.targetMapId);
        expect(target, `${id} → ${transition.targetMapId}`).toBeDefined();
        expect(target!.transitions.some((t) => t.targetMapId === id)).toBe(true);
      }
    }
  });

  it("never places a transition on a colliding tile", () => {
    for (const id of MAP_IDS) {
      const map = maps.get(id)!;
      for (const t of map.transitions) expect(map.collidesAt(t.x, t.y), `${id}`).toBe(false);
    }
  });

  it("lands the player on a walkable tile in the destination", () => {
    for (const id of MAP_IDS) {
      for (const t of maps.get(id)!.transitions) {
        const target = maps.get(t.targetMapId)!;
        expect(target.collidesAt(t.targetX, t.targetY), `${id} → ${t.targetMapId}`).toBe(false);
      }
    }
  });

  it("looks up a transition by tile", () => {
    const village = maps.get("village")!;
    const t = village.transitions[0]!;
    expect(village.transitionAt(t.x, t.y)).toBe(t);
    expect(village.transitionAt(1, 1)).toBeNull();
  });
});
