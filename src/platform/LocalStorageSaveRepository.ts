import type { PlayerState } from "../core/player/playerState";
import type { SaveLoadResult, SaveRepository } from "../core/save/SaveRepository";
import { SAVE_STORAGE_KEY, deserialize, serialize } from "../core/save/serialize";

/**
 * Browser persistence (FR-053 … FR-056, contracts/save-format.md).
 *
 * Lives in `src/platform` because `localStorage` is a DOM global — it does not exist during
 * server rendering and does not exist in a Node test. Keeping it behind the core-owned interface
 * is what lets every gameplay module stay testable AND server-renderable at once.
 *
 * MUST be constructed inside the client-mounted game, never at module scope.
 */
export function createLocalStorageSaveRepository(gameVersion = "0.1.0"): SaveRepository {
  /**
   * Probe by actually writing. Private browsing and quota-exhausted storage both expose a
   * `localStorage` object that throws on write, so merely checking it exists proves nothing.
   */
  const available = ((): boolean => {
    try {
      const probe = `${SAVE_STORAGE_KEY}:probe`;
      window.localStorage.setItem(probe, "1");
      window.localStorage.removeItem(probe);
      return true;
    } catch {
      return false;
    }
  })();

  return {
    isAvailable: () => available,

    load(): SaveLoadResult {
      if (!available) return { status: "empty" };
      let raw: string | null;
      try {
        raw = window.localStorage.getItem(SAVE_STORAGE_KEY);
      } catch {
        return { status: "unreadable", reason: "storage-unreadable" };
      }
      if (raw === null) return { status: "empty" };

      const result = deserialize(raw);
      return result.status === "ok"
        ? { status: "ok", player: result.player as PlayerState }
        : { status: "unreadable", reason: result.reason };
    },

    save(player: PlayerState): void {
      if (!available) return; // The player was already warned; failing loudly every turn helps nobody.
      try {
        window.localStorage.setItem(SAVE_STORAGE_KEY, serialize(player, gameVersion));
      } catch {
        // Quota exhausted mid-session. Progress stops persisting; the game keeps running.
      }
    },

    clear(): void {
      if (!available) return;
      try {
        window.localStorage.removeItem(SAVE_STORAGE_KEY);
      } catch {
        // Nothing useful to do.
      }
    },
  };
}
