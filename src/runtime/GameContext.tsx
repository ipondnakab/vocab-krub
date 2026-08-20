"use client";

import { createContext, useContext } from "react";
import type { GameStore } from "./GameStore";
import { useDispatch, useGameState } from "./useGameState";
import type { GameState } from "./GameStore";
import type { Intent } from "./intents";

import type { ContentIndex } from "../core/content/loadContent";

const StoreContext = createContext<GameStore | null>(null);
const ContentContext = createContext<ContentIndex | null>(null);

export function GameStoreProvider({
  store, content, children,
}: {
  store: GameStore;
  content: ContentIndex;
  children: React.ReactNode;
}) {
  return (
    <StoreContext.Provider value={store}>
      <ContentContext.Provider value={content}>{children}</ContentContext.Provider>
    </StoreContext.Provider>
  );
}

/**
 * Validated content. Separate from GameState on purpose: GameState is for things that change,
 * and putting an immutable index in it would make every selector diff a large object for no
 * reason.
 */
export function useContent(): ContentIndex {
  const content = useContext(ContentContext);
  if (!content) throw new Error("useContent must be used inside a GameStoreProvider");
  return content;
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
