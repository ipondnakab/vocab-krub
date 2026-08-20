import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { generatePlaceholders } from "../../scripts/generate-placeholders.ts";
import { readPngSize } from "../../scripts/png.ts";
import npcs from "../../src/content/data/npcs.json" with { type: "json" };
import monsters from "../../src/content/data/monsters.json" with { type: "json" };
import chaptersJson from "../../src/content/data/chapters.json" with { type: "json" };

/** Derived from content so adding a chapter's maps does not require editing this test. */
const MAP_IDS = chaptersJson.chapters.flatMap((c) => c.mapIds);

/**
 * The asset contract, enforced (contracts/asset-contract.md).
 *
 * This test is what stops the contract and the code from drifting apart before the owner's real
 * art arrives. If a placeholder generated FROM the documented dimensions fails here, the
 * document and the implementation disagree — and that is a bug to fix now, while it is cheap.
 */
const OUT = join(process.cwd(), "public", "assets", "placeholder");

const size = (relative: string) => readPngSize(readFileSync(join(OUT, relative)));
const map = (name: string) =>
  JSON.parse(readFileSync(join(OUT, "maps", `${name}.tmj`), "utf8")) as {
    width: number; height: number; tilewidth: number; tileheight: number;
    layers: Array<{ name: string; type: string; objects?: Array<{ type: string; properties: Array<{ name: string; value: unknown }> }> }>;
    tilesets: Array<{ tilewidth: number; tileheight: number; margin: number; spacing: number; tiles: Array<{ id: number; properties: Array<{ name: string; value: unknown }> }> }>;
  };

const prop = (obj: { properties: Array<{ name: string; value: unknown }> }, name: string) =>
  obj.properties.find((p) => p.name === name)?.value;

beforeAll(() => {
  generatePlaceholders(OUT);
});

describe("character sprite sheets (§ 2)", () => {
  it("are 4 columns x 4 rows of 32x48", () => {
    expect(size("characters/player.png")).toEqual({ width: 128, height: 192 });
  });

  it("exist for every NPC in content", () => {
    for (const npc of npcs.npcs) {
      expect(existsSync(join(OUT, `characters/${npc.id}.png`)), npc.id).toBe(true);
      expect(size(`characters/${npc.id}.png`)).toEqual({ width: 128, height: 192 });
    }
  });
});

describe("monster sprites (§ 3)", () => {
  it("are 4 frames of 96x96 — idle, hurt, attack, restored", () => {
    for (const monster of monsters.monsters) {
      expect(size(`monsters/${monster.id}.png`)).toEqual({ width: 384, height: 96 });
    }
  });

  it("have a separate 32x32 overworld sprite", () => {
    for (const monster of monsters.monsters) {
      expect(size(`monsters/${monster.id}-overworld.png`)).toEqual({ width: 32, height: 32 });
    }
  });

  it("declare 4 frames in content, matching the sheet", () => {
    for (const monster of monsters.monsters) expect(monster.sprite.frames).toBe(4);
  });
});

describe("portraits and UI (§ 4, § 7)", () => {
  it("renders portraits at 96x96", () => {
    for (const npc of npcs.npcs) expect(size(`portraits/${npc.portrait}.png`)).toEqual({ width: 96, height: 96 });
  });

  it("ships mastery stars at 16x16", () => {
    expect(size("ui/star-filled.png")).toEqual({ width: 16, height: 16 });
    expect(size("ui/star-empty.png")).toEqual({ width: 16, height: 16 });
  });

  it("ships NO UI chrome art — React renders it in CSS (R-014)", () => {
    // These were in the original contract and were removed when the stack changed. If one
    // reappears, someone is drawing what CSS should be doing.
    for (const gone of ["dialogue-box.png", "menu-panel.png", "option-button.png", "hp-bar-frame.png"]) {
      expect(existsSync(join(OUT, "ui", gone)), gone).toBe(false);
    }
  });
});

describe("tilesets (§ 5)", () => {
  it("use 32x32 tiles with no margin or spacing", () => {
    for (const name of MAP_IDS) {
      const { tilewidth, tileheight, margin, spacing } = map(name).tilesets[0]!;
      expect({ tilewidth, tileheight, margin, spacing }).toEqual({
        tilewidth: 32, tileheight: 32, margin: 0, spacing: 0,
      });
    }
  });

  it("carry `collides` on the TILE, so it stays correct wherever the tile is placed", () => {
    const solid = map("village").tilesets[0]!.tiles;
    expect(solid.length).toBeGreaterThan(0);
    for (const tile of solid) expect(prop(tile, "collides")).toBe(true);
  });
});

describe("maps (§ 6)", () => {
  const REQUIRED_LAYERS = ["ground", "decoration", "collision", "above", "spawns", "transitions"];

  it("exist for village, forest, and cave", () => {
    for (const name of MAP_IDS) {
      expect(existsSync(join(OUT, "maps", `${name}.tmj`)), name).toBe(true);
    }
  });

  it("contain ALL SIX contracted layer names", () => {
    // The loader looks these up by name and fails loudly on a missing one, so every map must
    // emit every layer even when it is empty.
    for (const name of MAP_IDS) {
      const names = map(name).layers.map((l) => l.name);
      for (const required of REQUIRED_LAYERS) expect(names, `${name} is missing '${required}'`).toContain(required);
    }
  });

  it("use the correct layer types", () => {
    const layers = map("village").layers;
    for (const name of ["ground", "decoration", "collision", "above"]) {
      expect(layers.find((l) => l.name === name)?.type).toBe("tilelayer");
    }
    for (const name of ["spawns", "transitions"]) {
      expect(layers.find((l) => l.name === name)?.type).toBe("objectgroup");
    }
  });

  it("place a player start on the village map", () => {
    const spawns = map("village").layers.find((l) => l.name === "spawns")!.objects!;
    const start = spawns.filter((o) => o.type === "player-start");
    expect(start).toHaveLength(1);
    expect(prop(start[0]!, "facing")).toBeTruthy();
  });

  it("reference only real npc and monster ids in spawns", () => {
    const npcIds = new Set(npcs.npcs.map((n) => n.id));
    const monsterIds = new Set(monsters.monsters.map((m) => m.id));
    for (const name of MAP_IDS) {
      for (const obj of map(name).layers.find((l) => l.name === "spawns")!.objects!) {
        if (obj.type === "npc") expect(npcIds).toContain(prop(obj, "npcId"));
        if (obj.type === "monster") expect(monsterIds).toContain(prop(obj, "monsterId"));
      }
    }
  });

  it("give every transition a counterpart in its destination map", () => {
    // The stranded-player edge case: a one-way link is a map you can enter and never leave.
    const names = MAP_IDS;
    const maps = new Map(names.map((n) => [n, map(n)]));
    for (const [name, data] of maps) {
      for (const t of data.layers.find((l) => l.name === "transitions")!.objects!) {
        const target = String(prop(t, "targetMapId"));
        expect(names, `${name} → ${target}`).toContain(target);
        const back = maps.get(target)!.layers.find((l) => l.name === "transitions")!.objects!;
        expect(
          back.some((b) => String(prop(b, "targetMapId")) === name),
          `${target} has no transition back to ${name}`,
        ).toBe(true);
      }
    }
  });

  it("never places a transition on a colliding tile", () => {
    // A transition the player cannot step onto is a dead end that looks like a door.
    for (const name of MAP_IDS) {
      const data = map(name);
      const collision = data.layers.find((l) => l.name === "collision") as unknown as { data: number[] };
      for (const t of data.layers.find((l) => l.name === "transitions")!.objects! as unknown as Array<{ x: number; y: number }>) {
        const index = (t.y / data.tileheight) * data.width + t.x / data.tilewidth;
        expect(collision.data[index], `${name} transition at ${t.x},${t.y} is blocked`).toBe(0);
      }
    }
  });
});
