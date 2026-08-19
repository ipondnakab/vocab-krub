import type { BalanceConfig } from "../content/schemas/index.js";
import type { Locale } from "../core/i18n/i18n.js";
import { createNewPlayer, type PlayerState } from "../core/player/playerState.js";
import type { SaveRepository } from "../core/save/SaveRepository.js";
import type { Intent } from "./intents.js";

/**
 * The runtime bridge (contracts/runtime-bridge.md).
 *
 * One source of truth, two subscribers: React renders text, Phaser renders the world. Both read
 * THIS state. Neither keeps a copy, which is why an HP bar can never disagree with a sprite.
 *
 * THE RULE: this layer routes, `src/core` decides. If you find a calculation here — damage,
 * victory, mastery, rewards — it is misplaced. The store stores; it does not compute.
 */

export type Screen = "title" | "world" | "journal";

export interface Notice {
  kind: "storage-unavailable" | "save-unreadable" | "content-error";
  detail?: string;
}

/**
 * SCOPE NOTE — `battle`, `dialogue`, `challenge`, and `world` slots are added by the phases that
 * define their state types (US1 → BattleState, US3 → DialogueState, US6 → ChallengeState).
 * Adding them now would mean inventing shapes before their rules exist. Principle VI.
 */
export interface GameState {
  screen: Screen;
  player: PlayerState;
  notice: Notice | null;
}

export interface GameStore {
  getSnapshot(): GameState;
  subscribe(listener: () => void): () => void;
  dispatch(intent: Intent): void;
}

export interface GameStoreDeps {
  /**
   * `content: ContentIndex` joins these deps in T039, when starting a battle first needs it.
   * Carrying an unused dependency now would be dead weight, and Principle VI says wait.
   */
  balance: BalanceConfig;
  save: SaveRepository;
  startMapId: string;
  startX: number;
  startY: number;
  locale?: Locale;
}

/**
 * Guards run BEFORE an intent is applied. A guard that returns false means the intent is
 * DROPPED — not queued, not deferred (FR-010). Queuing is what lets an answer submitted during
 * a death animation resolve into a battle that already ended.
 *
 * US1 adds the battle guard here: `answer-question` is dropped unless
 * `battle.phase === "awaiting-answer"`.
 */
function canDispatch(intent: Intent, state: GameState): boolean {
  switch (intent.type) {
    case "dismiss-notice":
      return state.notice !== null;
    case "continue-game":
      return state.screen === "title";
    case "new-game":
    case "set-locale":
      return true;
  }
}

export function createGameStore(deps: GameStoreDeps): GameStore {
  const freshPlayer = (): PlayerState =>
    createNewPlayer(deps.balance, {
      startMapId: deps.startMapId,
      startX: deps.startX,
      startY: deps.startY,
      ...(deps.locale !== undefined ? { locale: deps.locale } : {}),
    });

  let state: GameState = {
    screen: "title",
    player: freshPlayer(),
    notice: deps.save.isAvailable() ? null : { kind: "storage-unavailable" },
  };

  const listeners = new Set<() => void>();

  /** Snapshot identity changes only when state changes, so useSyncExternalStore behaves. */
  const commit = (next: GameState): void => {
    if (next === state) return;
    state = next;
    for (const listener of listeners) listener();
  };

  return {
    getSnapshot: () => state,

    subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },

    dispatch(intent) {
      if (!canDispatch(intent, state)) return;

      switch (intent.type) {
        case "new-game": {
          const player = freshPlayer();
          deps.save.save(player);
          commit({ ...state, screen: "world", player });
          return;
        }
        case "continue-game": {
          const result = deps.save.load();
          if (result.status === "ok") {
            commit({ ...state, screen: "world", player: result.player, notice: null });
          } else if (result.status === "empty") {
            const player = freshPlayer();
            commit({ ...state, screen: "world", player });
          } else {
            commit({ ...state, notice: { kind: "save-unreadable", detail: result.reason } });
          }
          return;
        }
        case "set-locale": {
          const player = { ...state.player, locale: intent.locale };
          commit({ ...state, player });
          return;
        }
        case "dismiss-notice": {
          commit({ ...state, notice: null });
          return;
        }
      }
    },
  };
}
