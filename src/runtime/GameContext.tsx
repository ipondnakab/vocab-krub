"use client";

import { createContext, useContext } from "react";
import type { GameStore } from "./GameStore";
import { useDispatch, useGameState } from "./useGameState";
import type { GameState } from "./GameStore";
import type { Intent } from "./intents";

const StoreContext = createContext<GameStore | null>(null);

export function GameStoreProvider({ store, children }: { store: GameStore; children: React.ReactNode }) {
  return <StoreContext.Provider value={store}>{children}</StoreContext.Provider>;
}

function useStore(): GameStore {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useGame must be used inside a GameStoreProvider");
  return store;
}

/** Select the NARROWEST slice you need — selecting whole state re-renders on every HP tick. */
export function useGame<T>(selector: (state: GameState) => T): T {
  return useGameState(useStore(), selector);
}

export function useGameDispatch(): (intent: Intent) => void {
  return useDispatch(useStore());
}
