"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { rawContentFiles } from "../content/data/index";
import { loadContent } from "../core/content/loadContent";
import { ContentValidationError } from "../core/content/errors";
import { createRng } from "../core/rng/rng";
import { createMemorySaveRepository } from "../platform/MemorySaveRepository";
import { createGameStore } from "../runtime/GameStore";
import { GameStoreProvider } from "../runtime/GameContext";
import { BattleHud } from "./battle/BattleHud";
import { WorldHud } from "./hud/WorldHud";
import { DialogueBox } from "./dialogue/DialogueBox";
import { WordJournal } from "./journal/WordJournal";
import { MasteryMoment } from "./battle/MasteryMoment";
import { ChallengePanel } from "./challenge/ChallengePanel";
import { loadMapFile } from "../platform/loadMapFile";
import { parseMap } from "../core/world/mapData";
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
  const mapId = devShortcuts ? params.get("map") : null;

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

      return { store, content, error: null as string | null, startMapId: mapId ?? "village" };
    } catch (error) {
      // Content failures surface as a readable screen, never a half-loaded world (FR-050).
      const message =
        error instanceof ContentValidationError ? error.message : String(error);
      return { store: null, content: null, error: message, startMapId: "village" };
    }
  }, [battleId, seedParam, localeParam, mapId]);

  const store = boot.store;
  const [mapError, setMapError] = useState<string | null>(null);

  /**
   * Map loading is async, so it lives here rather than inside `dispatch`. The store records a
   * pending transition; this effect fetches, parses, and dispatches `enter-map` — which keeps
   * every rule in the store synchronous and testable.
   */
  useEffect(() => {
    if (!store || battleId) return;
    let cancelled = false;

    const load = async (id: string) => {
      try {
        const raw = await loadMapFile(id);
        if (cancelled) return;
        store.dispatch({ type: "enter-map", map: parseMap(id, raw) });
      } catch (error) {
        if (!cancelled) setMapError(String(error));
      }
    };

    void load(boot.startMapId);

    const unsubscribe = store.subscribe(() => {
      const world = store.getSnapshot().world;
      const pending = world?.pendingTransition;
      if (pending && pending.targetMapId !== world?.map.id) void load(pending.targetMapId);
    });

    return () => {
      // Both, not either: unsubscribing alone would leave an in-flight fetch to dispatch into a
      // store this component no longer owns.
      cancelled = true;
      unsubscribe();
    };
  }, [store, battleId, boot.startMapId]);

  if (mapError) {
    return (
      <main style={{ padding: "2rem" }}>
        <div className="panel">
          <p className="label">Map error</p>
          <pre style={{ whiteSpace: "pre-wrap", color: "var(--wrong)" }}>{mapError}</pre>
        </div>
      </main>
    );
  }

  if (boot.error || !boot.store || !boot.content) {
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
    <GameStoreProvider store={boot.store} content={boot.content}>
      <div className="stage">
        <GameCanvas store={boot.store} />
        <WorldHud />
        <DialogueBox />
        <ChallengePanel />
        <BattleHud />
        <MasteryMoment />
        <WordJournal />
      </div>
    </GameStoreProvider>
  );
}
