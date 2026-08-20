/**
 * Asset paths and the placeholder fallback (contracts/asset-contract.md § 11).
 *
 * Real art lives at `/assets/<category>/<name>`; generated placeholders mirror the same paths
 * under `/assets/placeholder/`. The loader tries the real path first and falls back, which is
 * what makes "drop conforming files in, change no code" literally true rather than aspirational.
 */
export const REAL_ROOT = "/assets";
export const PLACEHOLDER_ROOT = "/assets/placeholder";

export interface SpriteSheetSpec {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
}

/** Contract § 2: 32x48 frames, 4 columns x 4 rows. */
export const CHARACTER_FRAME = { frameWidth: 32, frameHeight: 48 } as const;
/** Contract § 3: 96x96 battle frames, 4 in a row. */
export const MONSTER_FRAME = { frameWidth: 96, frameHeight: 96 } as const;

/** Contract § 3 frame order. Frame 3 is the word RESTORED, not a corpse. */
export const MONSTER_FRAMES = { idle: 0, hurt: 1, attack: 2, restored: 3 } as const;

export function monsterSheet(monsterId: string): SpriteSheetSpec {
  return { key: `monster:${monsterId}`, path: `monsters/${monsterId}.png`, ...MONSTER_FRAME };
}

/** Contract § 3: a separate single-frame 32x32 sprite for the overworld. */
export function monsterOverworld(monsterId: string): { key: string; path: string } {
  return { key: `overworld:${monsterId}`, path: `monsters/${monsterId}-overworld.png` };
}

export function characterSheet(id: string): SpriteSheetSpec {
  return { key: `char:${id}`, path: `characters/${id}.png`, ...CHARACTER_FRAME };
}

export function tilesetImage(mapId: string): { key: string; path: string } {
  return { key: `tiles:${mapId}`, path: `tilesets/${mapId}.png` };
}

export function tilemapKey(mapId: string): string {
  return `tilemap:${mapId}`;
}

/** Contract § 2 row order: 0 down, 1 left, 2 right, 3 up. Columns: idle, step A, idle, step B. */
export const CHARACTER_ROWS = { down: 0, left: 1, right: 2, up: 3 } as const;
export const CHARACTER_COLUMNS = 4;
export const WALK_FPS = 8;
