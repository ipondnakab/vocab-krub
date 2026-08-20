import { PLACEHOLDER_ROOT, REAL_ROOT } from "../phaser/assets";

/**
 * Fetches a Tiled map document, preferring the owner's real map and falling back to the
 * generated placeholder (asset contract § 11).
 *
 * Lives in `src/platform` because it touches the network — `src/core` parses what this returns
 * but never fetches it, which is what keeps map parsing testable from a plain Node test.
 */
export async function loadMapFile(mapId: string): Promise<unknown> {
  for (const root of [REAL_ROOT, PLACEHOLDER_ROOT]) {
    const response = await fetch(`${root}/maps/${mapId}.tmj`);
    if (response.ok) return response.json();
  }
  throw new Error(`Map '${mapId}' could not be loaded from ${REAL_ROOT} or ${PLACEHOLDER_ROOT}`);
}
