import type { PlayerState } from "../core/player/playerState";
import type { SaveLoadResult, SaveRepository } from "../core/save/SaveRepository";

/**
 * An in-memory save repository.
 *
 * Real persistence is US7: T110 adds `LocalStorageSaveRepository` against this same interface,
 * and T129 a server-backed one. Neither will touch a gameplay module — that is the whole point
 * of the interface living in `src/core`.
 *
 * This exists because the store genuinely needs a repository NOW, not as a placeholder for an
 * unspecified feature.
 */
export function createMemorySaveRepository(): SaveRepository {
  let saved: PlayerState | null = null;
  return {
    isAvailable: () => true,
    load: (): SaveLoadResult => (saved ? { status: "ok", player: saved } : { status: "empty" }),
    save: (player) => {
      saved = player;
    },
    clear: () => {
      saved = null;
    },
  };
}
