import { rawContentFiles } from "../../src/content/data/index";
import { loadContent, type ContentIndex } from "../../src/core/content/loadContent";
import { createNewPlayer, type PlayerState } from "../../src/core/player/playerState";
import { createRng, type Rng } from "../../src/core/rng/rng";
import type { BattleDeps } from "../../src/core/battle/battle";

/** Tests run against the REAL shipped content, so a content change that breaks a rule shows up here. */
export const content: ContentIndex = loadContent(rawContentFiles);
export const balance = content.balance;

export function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    ...createNewPlayer(balance, { startMapId: "village", startX: 3, startY: 7 }),
    // Both topics learned by default so grammar gating does not silently empty the pool in
    // tests that are not about grammar gating.
    grammarLearned: ["present-simple", "past-simple"],
    ...overrides,
  };
}

export function deps(seed = 1): BattleDeps {
  return { content, balance, rng: createRng(seed) };
}

export function rng(seed = 1): Rng {
  return createRng(seed);
}

/** A deterministic Rng returning a scripted sequence — for asserting exact branch outcomes. */
export function scriptedRng(values: number[]): Rng {
  let i = 0;
  const next = () => {
    const v = values[i % values.length] ?? 0;
    i += 1;
    return v;
  };
  return {
    next,
    int: (max) => Math.floor(next() * max),
    pick: (items) => items[Math.floor(next() * items.length)]!,
    shuffle: (items) => [...items],
  };
}
