import { useCallback, useSyncExternalStore } from "react";
import type { GameState, GameStore } from "./GameStore.js";
import type { Intent } from "./intents.js";

/**
 * React binding for the bridge.
 *
 * `useSyncExternalStore` is React's built-in answer for exactly this shape — an external mutable
 * source feeding React — so no state library is needed (research R-015).
 *
 * Select the narrowest slice you need. A component that selects the whole state re-renders on
 * every HP tick, including the journal.
 */
export function useGameState<T>(store: GameStore, selector: (state: GameState) => T): T {
  const getSelection = useCallback(() => selector(store.getSnapshot()), [store, selector]);
  return useSyncExternalStore(store.subscribe, getSelection, getSelection);
}

export function useDispatch(store: GameStore): (intent: Intent) => void {
  return useCallback((intent: Intent) => store.dispatch(intent), [store]);
}
