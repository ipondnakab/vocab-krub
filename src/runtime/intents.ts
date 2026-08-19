/**
 * Intents — the only way a renderer changes anything (contracts/runtime-bridge.md).
 *
 * React components and Phaser scenes never mutate state. They send one of these, the store
 * forwards it to `src/core`, and the store stores what core returns.
 *
 * SCOPE NOTE — the union grows with the features that handle it. Constitution Principle VI
 * forbids placeholder architecture for unspecified features, so `answer-question`, `move`,
 * `interact`, and the rest arrive in the phase that implements them (US1 … US6) rather than
 * sitting here as unhandled variants. What is defined now is what has a handler now.
 */
export type Intent =
  | { type: "new-game" }
  | { type: "continue-game" }
  | { type: "set-locale"; locale: "th" | "en" }
  | { type: "dismiss-notice" };

export type IntentType = Intent["type"];
