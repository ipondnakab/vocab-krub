import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Canvas, type Rgba } from "./png.ts";
import npcs from "../src/content/data/npcs.json" with { type: "json" };
import monsters from "../src/content/data/monsters.json" with { type: "json" };
import chapters from "../src/content/data/chapters.json" with { type: "json" };

/**
 * Generates conforming placeholder assets (contracts/asset-contract.md).
 *
 * Two jobs:
 *
 *  1. Unblock every map, movement, dialogue, and battle task before the owner's art exists.
 *  2. VALIDATE THE CONTRACT. These files are generated from the documented dimensions and frame
 *     order. If a placeholder does not work in the game, the contract and the code disagree, and
 *     that is a bug to fix now — not after real art arrives and the mismatch is expensive.
 *
 * What is deliberately NOT generated: dialogue frames, buttons, panels, and bars. React renders
 * UI chrome in CSS (research R-014), so those are not art and never block on the owner.
 *
 * The asset list is derived from content data, so adding an NPC or monster to JSON produces its
 * placeholder automatically — Principle III applies to tooling too.
 */

const TILE = 32;
const CHAR_W = 32;
const CHAR_H = 48;
const MONSTER_FRAME = 96;
const PORTRAIT = 96;
const MAP_W = 20;
const MAP_H = 15;

const INK: Rgba = [16, 12, 28, 255];
const PLACEHOLDER_MARK: Rgba = [255, 0, 220, 255];

/** Distinct, obviously-fake hues. Nobody will mistake these for finished art. */
function hue(index: number, lightness = 1): Rgba {
  const palette: Rgba[] = [
    [214, 92, 92, 255], [92, 160, 214, 255], [120, 196, 118, 255], [222, 176, 84, 255],
    [166, 118, 208, 255], [96, 200, 196, 255], [226, 132, 84, 255], [150, 150, 168, 255],
  ];
  const base = palette[index % palette.length] as Rgba;
  return [
    Math.min(255, Math.round(base[0] * lightness)),
    Math.min(255, Math.round(base[1] * lightness)),
    Math.min(255, Math.round(base[2] * lightness)),
    255,
  ];
}

function write(outDir: string, relative: string, data: Buffer | string): void {
  const path = join(outDir, relative);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, data);
}

/**
 * Character sheet: 4 columns x 4 rows of 32x48.
 * Rows: 0 down, 1 left, 2 right, 3 up. Columns: 0 idle, 1 step A, 2 idle, 3 step B.
 */
function characterSheet(seed: number): Buffer {
  const canvas = new Canvas(CHAR_W * 4, CHAR_H * 4);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = col * CHAR_W;
      const y = row * CHAR_H;
      // Column 2 repeats column 0's idle pose, per the RPG Maker walk convention.
      const pose = col === 2 ? 0 : col;
      canvas.fillRect(x, y, CHAR_W, CHAR_H, hue(seed + row, 0.55));
      canvas.fillRect(x + 6, y + 8, 20, 22, hue(seed + row, 1));   // head/body
      canvas.fillRect(x + 10 + pose * 2, y + 30, 5, 14, INK);       // legs shift per pose
      canvas.fillRect(x + 18 - pose * 2, y + 30, 5, 14, INK);
      canvas.strokeRect(x, y, CHAR_W, CHAR_H, PLACEHOLDER_MARK);
      canvas.tally(x + 2, y + 2, row + 1, INK);                     // row = facing
      canvas.tally(x + 2, y + CHAR_H - 5, col + 1, PLACEHOLDER_MARK); // col = frame
    }
  }
  return canvas.toPng();
}

/** Monster battle sheet: 4 frames of 96x96 — idle, hurt, attack, RESTORED. */
function monsterSheet(seed: number): Buffer {
  const canvas = new Canvas(MONSTER_FRAME * 4, MONSTER_FRAME);
  // Frame 3 is the word being freed from The Silence, not a corpse (Principle I).
  const frameTint = [0.7, 1.15, 0.9, 1.45];
  for (let frame = 0; frame < 4; frame += 1) {
    const x = frame * MONSTER_FRAME;
    canvas.fillRect(x, 0, MONSTER_FRAME, MONSTER_FRAME, hue(seed, 0.35));
    const inset = frame === 3 ? 14 : 20;
    canvas.fillRect(x + inset, inset, MONSTER_FRAME - inset * 2, MONSTER_FRAME - inset * 2,
      hue(seed, frameTint[frame] as number));
    canvas.strokeRect(x, 0, MONSTER_FRAME, MONSTER_FRAME, PLACEHOLDER_MARK);
    canvas.tally(x + 4, 4, frame + 1, INK);
  }
  return canvas.toPng();
}

function singleTile(seed: number): Buffer {
  const canvas = new Canvas(TILE, TILE);
  canvas.fillRect(0, 0, TILE, TILE, hue(seed));
  canvas.strokeRect(0, 0, TILE, TILE, PLACEHOLDER_MARK);
  return canvas.toPng();
}

function portrait(seed: number): Buffer {
  const canvas = new Canvas(PORTRAIT, PORTRAIT);
  canvas.fillRect(0, 0, PORTRAIT, PORTRAIT, hue(seed, 0.5));
  canvas.fillRect(24, 20, 48, 56, hue(seed));
  canvas.strokeRect(0, 0, PORTRAIT, PORTRAIT, PLACEHOLDER_MARK);
  return canvas.toPng();
}

/** 4x4 grid of 32px tiles. Indices 0-3 walkable, 4-7 solid, 8-15 spare. */
const TILESET_COLUMNS = 4;
const TILESET_ROWS = 4;
const TILESET_COUNT = TILESET_COLUMNS * TILESET_ROWS;
const SOLID_TILE_INDICES = [4, 5, 6, 7];
const GROUND_GID = 1;   // index 0
const PATH_GID = 2;     // index 1
const SOLID_GID = 5;    // index 4

function tileset(seed: number): Buffer {
  const canvas = new Canvas(TILE * TILESET_COLUMNS, TILE * TILESET_ROWS);
  for (let i = 0; i < TILESET_COUNT; i += 1) {
    const x = (i % TILESET_COLUMNS) * TILE;
    const y = Math.floor(i / TILESET_COLUMNS) * TILE;
    const solid = SOLID_TILE_INDICES.includes(i);
    canvas.fillRect(x, y, TILE, TILE, hue(seed + i, solid ? 0.5 : 1.05));
    if (solid) canvas.strokeRect(x + 2, y + 2, TILE - 4, TILE - 4, INK);
    canvas.strokeRect(x, y, TILE, TILE, PLACEHOLDER_MARK);
  }
  return canvas.toPng();
}

interface SpawnObject {
  type: string;
  tileX: number;
  tileY: number;
  properties: Record<string, string | number | boolean>;
}

interface TransitionObject {
  tileX: number;
  tileY: number;
  targetMapId: string;
  targetX: number;
  targetY: number;
  facing: string;
}

function tiledObject(id: number, type: string, tileX: number, tileY: number,
                     properties: Record<string, string | number | boolean>): unknown {
  return {
    id, name: "", type, rotation: 0, visible: true,
    x: tileX * TILE, y: tileY * TILE, width: TILE, height: TILE,
    properties: Object.entries(properties).map(([name, value]) => ({
      name,
      type: typeof value === "boolean" ? "bool" : typeof value === "number" ? "int" : "string",
      value,
    })),
  };
}

/**
 * Builds a .tmj with ALL SIX contracted layer names. The loader looks these up by name and fails
 * loudly on a missing one, so the generator must emit every one even when empty.
 */
function tiledMap(name: string, spawns: SpawnObject[], transitions: TransitionObject[]): string {
  const size = MAP_W * MAP_H;
  const ground = new Array<number>(size).fill(GROUND_GID);
  const decoration = new Array<number>(size).fill(0);
  const collision = new Array<number>(size).fill(0);
  const above = new Array<number>(size).fill(0);

  const at = (x: number, y: number) => y * MAP_W + x;
  const openTiles = new Set(transitions.map((t) => at(t.tileX, t.tileY)));

  // Solid border, with a gap wherever a transition sits — otherwise the player is walled in.
  for (let x = 0; x < MAP_W; x += 1) {
    for (const y of [0, MAP_H - 1]) if (!openTiles.has(at(x, y))) collision[at(x, y)] = SOLID_GID;
  }
  for (let y = 0; y < MAP_H; y += 1) {
    for (const x of [0, MAP_W - 1]) if (!openTiles.has(at(x, y))) collision[at(x, y)] = SOLID_GID;
  }
  // A path across the middle, so the walkable route is obvious at a glance.
  for (let x = 1; x < MAP_W - 1; x += 1) ground[at(x, 7)] = PATH_GID;
  // A couple of interior obstacles to exercise collision.
  for (const [x, y] of [[5, 4], [6, 4], [13, 10], [14, 10]] as const) {
    collision[at(x, y)] = SOLID_GID;
    decoration[at(x, y)] = SOLID_GID;
  }

  let objectId = 1;
  const spawnObjects = spawns.map((s) => tiledObject(objectId++, s.type, s.tileX, s.tileY, s.properties));
  const transitionObjects = transitions.map((t) =>
    tiledObject(objectId++, "transition", t.tileX, t.tileY, {
      targetMapId: t.targetMapId, targetX: t.targetX, targetY: t.targetY, facing: t.facing,
    }),
  );

  const tileLayer = (id: number, layerName: string, data: number[]) => ({
    data, height: MAP_H, id, name: layerName, opacity: 1, type: "tilelayer",
    visible: true, width: MAP_W, x: 0, y: 0,
  });

  return JSON.stringify(
    {
      compressionlevel: -1, infinite: false, orientation: "orthogonal", renderorder: "right-down",
      tiledversion: "1.11.0", type: "map", version: "1.10",
      width: MAP_W, height: MAP_H, tilewidth: TILE, tileheight: TILE,
      nextlayerid: 7, nextobjectid: objectId,
      layers: [
        tileLayer(1, "ground", ground),
        tileLayer(2, "decoration", decoration),
        tileLayer(3, "collision", collision),
        tileLayer(4, "above", above),
        { draworder: "topdown", id: 5, name: "spawns", objects: spawnObjects, opacity: 1,
          type: "objectgroup", visible: true, x: 0, y: 0 },
        { draworder: "topdown", id: 6, name: "transitions", objects: transitionObjects, opacity: 1,
          type: "objectgroup", visible: true, x: 0, y: 0 },
      ],
      tilesets: [
        {
          firstgid: 1, name, image: `../tilesets/${name}.png`,
          imagewidth: TILE * TILESET_COLUMNS, imageheight: TILE * TILESET_ROWS,
          columns: TILESET_COLUMNS, tilecount: TILESET_COUNT,
          tilewidth: TILE, tileheight: TILE, margin: 0, spacing: 0,
          // Collision belongs to the TILE so it stays correct wherever the tile is placed.
          tiles: SOLID_TILE_INDICES.map((id) => ({
            id, properties: [{ name: "collides", type: "bool", value: true }],
          })),
        },
      ],
    },
    null,
    2,
  );
}

export function generatePlaceholders(outDir: string): string[] {
  const written: string[] = [];
  const emit = (relative: string, data: Buffer | string) => {
    write(outDir, relative, data);
    written.push(relative);
  };

  emit("characters/player.png", characterSheet(1));
  npcs.npcs.forEach((npc, i) => {
    emit(`characters/${npc.id}.png`, characterSheet(i + 2));
    emit(`portraits/${npc.portrait}.png`, portrait(i + 2));
  });

  monsters.monsters.forEach((monster, i) => {
    emit(`monsters/${monster.id}.png`, monsterSheet(i));
    emit(`monsters/${monster.id}-overworld.png`, singleTile(i));
  });

  // Map names come from chapters.json, so adding a chapter's maps is a content edit rather
  // than a code edit — the same rule the rest of the content pipeline follows.
  const maps = chapters.chapters.flatMap((c) => c.mapIds);
  maps.forEach((mapName, i) => emit(`tilesets/${mapName}.png`, tileset(i * 3)));

  // Stars stay art (asset contract § 7); every other UI element is CSS.
  const star = (filled: boolean) => {
    const canvas = new Canvas(16, 16);
    canvas.fillRect(0, 0, 16, 16, filled ? [240, 200, 70, 255] : [70, 66, 84, 255]);
    canvas.strokeRect(0, 0, 16, 16, PLACEHOLDER_MARK);
    return canvas.toPng();
  };
  emit("ui/star-filled.png", star(true));
  emit("ui/star-empty.png", star(false));

  // Hand-placed so every NPC lands inside the map, off the path row, and clear of the interior
  // obstacles. A naive stride ran the sixth villager straight off the east edge.
  // Hand-placed so every NPC lands inside the map, off the path row, and clear of the interior
  // obstacles. A naive stride ran the sixth villager straight off the east edge.
  const NPC_TILES: ReadonlyArray<readonly [number, number]> = [
    [3, 4], [8, 4], [12, 5], [16, 6], [5, 10], [10, 11],
  ];

  /**
   * Maps are generated per chapter, chained west-to-east within a chapter and linked across the
   * chapter boundary — so finishing one chapter's last map walks you into the next chapter's
   * first. Every transition gets its counterpart, because a one-way link is a map you enter and
   * cannot leave.
   */
  const chapterMaps = chapters.chapters.map((c) => ({ id: c.id, maps: c.mapIds }));
  const flat = chapterMaps.flatMap((c) => c.maps);

  for (let ci = 0; ci < chapterMaps.length; ci += 1) {
    const chapter = chapterMaps[ci] as { id: string; maps: string[] };
    const chapterNpcs = npcs.npcs.filter((n) => chapter.maps.includes(n.mapId));
    const chapterMonsters = monsters.monsters.filter((m) =>
      (chapters.chapters[ci]?.monsterIds ?? []).includes(m.id));

    chapter.maps.forEach((mapName, mi) => {
      const globalIndex = flat.indexOf(mapName);
      const previous = flat[globalIndex - 1];
      const next = flat[globalIndex + 1];

      const spawns: SpawnObject[] = [];
      if (globalIndex === 0) {
        spawns.push({ type: "player-start", tileX: 3, tileY: 7, properties: { facing: "down" } });
      }
      // NPCs stand on the map their content says they do.
      chapterNpcs
        .filter((n) => n.mapId === mapName)
        .forEach((n, i) => {
          const tile = NPC_TILES[i % NPC_TILES.length] as readonly [number, number];
          spawns.push({ type: "npc", tileX: tile[0], tileY: tile[1], properties: { npcId: n.id, facing: "down" } });
        });
      // Regular monsters spread evenly across the chapter's maps; the BOSS always stands on the
      // last one, so a chapter reads as a journey toward it rather than scattering it at random.
      const regular = chapterMonsters.filter((m) => !m.isBoss);
      const boss = chapterMonsters.filter((m) => m.isBoss);
      const isLastMap = mi === chapter.maps.length - 1;
      const forThisMap = [
        ...regular.filter((_, i) => i % chapter.maps.length === mi),
        ...(isLastMap ? boss : []),
      ];
      /*
       * Monsters stand OFF the path row.
       *
       * Row 7 is the only walkable corridor, so putting monsters on it turns the map into a
       * gauntlet the player cannot walk past — every encounter forced, none chosen. The spec is
       * explicit that encounters are player-initiated (Principle I: never ambushed into a
       * question), and a corridor full of monsters takes that away just as surely as a random
       * encounter would.
       *
       * Found by walking the map in a browser: the player could not reach the chapter exit
       * because three monsters sat between them and it.
       */
      const MONSTER_ROWS = [5, 9, 4, 10, 3, 11];
      forThisMap.forEach((m, i) => {
        spawns.push({
          type: "monster",
          tileX: 7 + i * 4,
          tileY: MONSTER_ROWS[i % MONSTER_ROWS.length] as number,
          // Radius 1 keeps a monster spawned two rows off the corridor from ever reaching it.
          // Clearing the SPAWN row was not enough: a radius of 2 let them patrol onto row 7 at
          // runtime and re-create the gauntlet. Constrained by construction rather than by luck.
          properties: { monsterId: m.id, patrolRadius: m.isBoss ? 0 : 1 },
        });
      });

      const transitions: TransitionObject[] = [];
      if (previous) {
        transitions.push({ tileX: 0, tileY: 7, targetMapId: previous, targetX: MAP_W - 2, targetY: 7, facing: "left" });
      }
      if (next) {
        transitions.push({ tileX: MAP_W - 1, tileY: 7, targetMapId: next, targetX: 1, targetY: 7, facing: "right" });
      }

      emit(`maps/${mapName}.tmj`, tiledMap(mapName, spawns, transitions));
    });
  }

  return written;
}

const invokedDirectly = process.argv[1]?.endsWith("generate-placeholders.ts") ?? false;
if (invokedDirectly) {
  const outDir = join(process.cwd(), "public", "assets", "placeholder");
  const written = generatePlaceholders(outDir);
  console.log(`Generated ${written.length} placeholder assets in ${outDir}`);
  for (const file of written) console.log(`  ${file}`);
}
