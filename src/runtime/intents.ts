import type { Direction } from "../content/schemas";
import type { GameMap } from "../core/world/mapData";

/**
 * Intents — the only way a renderer changes anything (contracts/runtime-bridge.md).
 *
 * React components and Phaser scenes never mutate state. They send one of these, the store
 * forwards it to `src/core`, and the store stores what core returns.
 *
 * The union grows with the features that handle it. Dialogue and the chapter challenge arrive in
 * US3 and US6 — a variant lands in the same phase as its handler, never earlier (Principle VI).
 */
export type Intent =
  | { type: "new-game" }
  | { type: "continue-game" }
  | { type: "set-locale"; locale: "th" | "en" }
  | { type: "dismiss-notice" }
  | { type: "start-battle"; monsterId: string }
  | { type: "answer-question"; optionIndex: number }
  | { type: "dismiss-feedback" }
  | { type: "attempt-flee" }
  | { type: "leave-battle" }
  /** Dispatched by the client once a map has been fetched and parsed (map loading is async). */
  | { type: "enter-map"; map: GameMap }
  | { type: "move"; direction: Direction }
  /** Advances monster patrol one tile. Driven by a timer in the world scene. */
  | { type: "step-world" }
  /** Talk to whoever the player is facing (FR-034). */
  | { type: "interact" }
  | { type: "advance-dialogue" }
  | { type: "answer-practice"; optionIndex: number }
  | { type: "close-dialogue" }
  | { type: "replay-lesson" };

export type IntentType = Intent["type"];
