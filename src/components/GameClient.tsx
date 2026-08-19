"use client";

import dynamic from "next/dynamic";
import { useMemo } from "react";
import { useSearchParams } from "next/navigation";
import { rawContentFiles } from "../content/data/index";
import { loadContent } from "../core/content/loadContent";
import { ContentValidationError } from "../core/content/errors";
import { createRng } from "../core/rng/rng";
import { createMemorySaveRepository } from "../platform/MemorySaveRepository";
import { createGameStore } from "../runtime/GameStore";
import { GameStoreProvider } from "../runtime/GameContext";
import { BattleHud } from "./battle/BattleHud";
import type { Locale } from "../core/i18n/i18n";

// Phaser touches `window` at module scope, so it must never be evaluated on the server.
const GameCanvas = dynamic(() => import("./GameCanvas").then((m) => m.GameCanvas), { ssr: false });

/**
 * T044 + T046. Boots the game.
 *
 * Dev query shortcuts (`?battle=`, `?seed=`, `?locale=`) exist so each user story can be tested
 * independently, as the spec requires. They are inert in production.
 */
export function GameClient() {
  const params = useSearchParams();
  const devShortcuts = process.env.NEXT_PUBLIC_DEV_SHORTCUTS === "1";

  const battleId = devShortcuts ? params.get("battle") : null;
  const seedParam = devShortcuts ? params.get("seed") : null;
  const localeParam = devShortcuts ? params.get("locale") : null;

  const boot = useMemo(() => {
    try {
      const content = loadContent(rawContentFiles);
      const seed = seedParam ? Number(seedParam) : Date.now();
      const locale: Locale = localeParam === "en" ? "en" : "th";

      const store = createGameStore({
        content,
        balance: content.balance,
        rng: createRng(Number.isFinite(seed) ? seed : Date.now()),
        save: createMemorySaveRepository(),
        startMapId: "village",
        startX: 3,
        startY: 7,
        locale,
      });

      store.dispatch({ type: "new-game" });
      if (battleId) store.dispatch({ type: "start-battle", monsterId: battleId });

      return { store, error: null as string | null };
    } catch (error) {
      // Content failures surface as a readable screen, never a half-loaded world (FR-050).
      const message =
        error instanceof ContentValidationError ? error.message : String(error);
      return { store: null, error: message };
    }
  }, [battleId, seedParam, localeParam]);

  if (boot.error || !boot.store) {
    return (
      <main style={{ padding: "2rem" }}>
        <div className="panel">
          <p className="label">Content error</p>
          <pre style={{ whiteSpace: "pre-wrap", color: "var(--wrong)" }}>{boot.error}</pre>
        </div>
      </main>
    );
  }

  return (
    <GameStoreProvider store={boot.store}>
      <div className="stage">
        <GameCanvas store={boot.store} />
        <BattleHud />
      </div>
    </GameStoreProvider>
  );
}
