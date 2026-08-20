import type { PlayerState } from "../core/player/playerState";
import type { SaveLoadResult, SaveRepository } from "../core/save/SaveRepository";
import { deserialize, serialize } from "../core/save/serialize";

/**
 * T129. A server-backed save adapter.
 *
 * This exists to answer one question: does the `SaveRepository` boundary actually hold? Adding
 * it must require ZERO changes to any gameplay module — and it did. If it had not, Principle II
 * was violated somewhere earlier and THAT would be the real bug.
 *
 * Deliberately built on the local adapter rather than replacing it. `SaveRepository.load()` is
 * synchronous because every rule that reads a save is synchronous, and making the whole engine
 * async to accommodate a network round trip would be the tail wagging the dog. So: the local
 * copy is authoritative for reads and the server is written through in the background. That is
 * also the behaviour a player wants — the game never stalls on a network hop mid-battle, and it
 * keeps working offline exactly as Stage 1 requires.
 *
 * Stage 2 (the shared open world) is where a server becomes load-bearing. This is the seam it
 * will use, not an implementation of it.
 */
export interface RemoteSaveOptions {
  endpoint: string;
  /** The local adapter that answers reads. */
  local: SaveRepository;
  /** Injected so this is testable without a network. */
  fetchImpl?: typeof fetch;
  onError?: (error: unknown) => void;
}

export function createRemoteSaveRepository(options: RemoteSaveOptions): SaveRepository {
  const doFetch = options.fetchImpl ?? globalThis.fetch;

  return {
    // Availability is the LOCAL adapter's answer. A player with no network can still play and
    // still keep their progress; a player with no storage cannot, and must be told (FR-056).
    isAvailable: () => options.local.isAvailable(),

    load(): SaveLoadResult {
      return options.local.load();
    },

    save(player: PlayerState): void {
      options.local.save(player);

      // Fire and forget. A failed sync must never interrupt play or lose the local write.
      void (async () => {
        try {
          await doFetch(options.endpoint, {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: serialize(player),
          });
        } catch (error) {
          options.onError?.(error);
        }
      })();
    },

    clear(): void {
      options.local.clear();
      void (async () => {
        try {
          await doFetch(options.endpoint, { method: "DELETE" });
        } catch (error) {
          options.onError?.(error);
        }
      })();
    },
  };
}

/** Pulls a server save and hands it to the local adapter, for a first load on a new device. */
export async function hydrateFromRemote(
  endpoint: string,
  local: SaveRepository,
  fetchImpl: typeof fetch = globalThis.fetch,
): Promise<SaveLoadResult> {
  try {
    const response = await fetchImpl(endpoint);
    if (!response.ok) return local.load();
    const raw = await response.text();
    const result = deserialize(raw);
    if (result.status !== "ok") return local.load();
    local.save(result.player as PlayerState);
    return { status: "ok", player: result.player as PlayerState };
  } catch {
    // Offline, or the server is down. The local save is the answer, not an error.
    return local.load();
  }
}
