import type { PlayerState } from "../player/playerState.js";

/**
 * Persistence boundary (FR-053, contracts/save-format.md).
 *
 * The interface lives in core; implementations live in src/platform. This is what keeps
 * `localStorage` — a DOM global that does not exist during server rendering and does not exist
 * in a Node test — out of every gameplay module. The Firebase/server adapter later implements
 * this same interface and changes nothing else (T129).
 */
export type SaveLoadResult =
  | { status: "ok"; player: PlayerState }
  /** No save exists. Start a new game — not an error (FR-055). */
  | { status: "empty" }
  /** Malformed, schema-invalid, or written by a newer version. Offer a new game, never crash. */
  | { status: "unreadable"; reason: string };

export interface SaveRepository {
  /** False when storage is disabled, full, or unavailable — warn the player (FR-056). */
  isAvailable(): boolean;
  load(): SaveLoadResult;
  save(player: PlayerState): void;
  clear(): void;
}
