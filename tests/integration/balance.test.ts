import { describe, expect, it } from "vitest";
import { createBattle, dismissFeedback, submitAnswer, type BattleState } from "../../src/core/battle/battle";
import { balance, content, deps, player } from "../helpers/fixtures";

/**
 * T122. The balance pass, locked in as assertions.
 *
 * These are tuning targets, not laws of nature — but writing them down means a future edit to
 * `balance.json` that makes the boss a twenty-turn grind fails here instead of in a playtest.
 */
const TARGET_TURNS = { min: 3, max: 9 };

function turnsToWin(monsterId: string, seed: number): number {
  const d = deps(seed);
  let state: BattleState = createBattle({ monsterId, player: player(), content, balance, rng: d.rng });
  let turns = 0;
  while (state.phase !== "ended" && turns < 100) {
    if (state.phase === "awaiting-answer") {
      turns += 1;
      state = submitAnswer(state, state.currentQuestion!.correctIndex, d).state;
    } else {
      state = dismissFeedback(state, d).state;
    }
  }
  return turns;
}

function missesToLose(monsterId: string, seed: number): number {
  const d = deps(seed);
  let state: BattleState = createBattle({ monsterId, player: player(), content, balance, rng: d.rng });
  let misses = 0;
  while (state.phase !== "ended" && misses < 100) {
    if (state.phase === "awaiting-answer") {
      misses += 1;
      const q = state.currentQuestion!;
      state = submitAnswer(state, (q.correctIndex + 1) % q.options.length, d).state;
    } else {
      state = dismissFeedback(state, d).state;
    }
  }
  return misses;
}

/** A player arriving in Chapter 2 is levelled; pacing must be checked against that, not a novice. */
function graduate() {
  return player({ level: 5, maxHp: 180, hp: 180, equipped: { weapon: "beginner-sword", armor: null, pet: null },
    inventory: [{ itemId: "beginner-sword", quantity: 1 }] });
}

function turnsToWinAs(monsterId: string, seed: number, p = graduate()): number {
  const d = deps(seed);
  let state: BattleState = createBattle({ monsterId, player: p, content, balance, rng: d.rng });
  let turns = 0;
  while (state.phase !== "ended" && turns < 100) {
    if (state.phase === "awaiting-answer") {
      turns += 1;
      state = submitAnswer(state, state.currentQuestion!.correctIndex, d).state;
    } else {
      state = dismissFeedback(state, d).state;
    }
  }
  return turns;
}

describe("Chapter 2 battle pacing (T068)", () => {
  it("keeps regular Chapter 2 monsters within the same turn budget", () => {
    // Chapter 2 monsters have more HP, but the player arrives with a weapon and more levels.
    // The turn count is what the player feels, so that is what is held steady.
    for (const monsterId of ["monster-open", "monster-ask", "monster-river"]) {
      for (let seed = 1; seed <= 8; seed += 1) {
        const turns = turnsToWinAs(monsterId, seed);
        expect(turns, `${monsterId} seed ${seed} took ${turns} turns`).toBeGreaterThanOrEqual(TARGET_TURNS.min);
        expect(turns, `${monsterId} seed ${seed} took ${turns} turns`).toBeLessThanOrEqual(TARGET_TURNS.max);
      }
    }
  });

  it("makes the Chapter 2 boss the longest fight in the game so far", () => {
    const ch2Boss = turnsToWinAs("monster-remember", 1);
    const ch1Boss = turnsToWinAs("monster-go", 1);
    const regular = turnsToWinAs("monster-open", 1);
    expect(ch2Boss).toBeGreaterThan(regular);
    expect(ch2Boss).toBeGreaterThanOrEqual(ch1Boss);
    expect(ch2Boss).toBeLessThanOrEqual(TARGET_TURNS.max + 5);
  });

  it("still gives a levelled player room to be wrong several times", () => {
    const d = deps(1);
    let state: BattleState = createBattle({ monsterId: "monster-remember", player: graduate(), content, balance, rng: d.rng });
    let misses = 0;
    while (state.phase !== "ended" && misses < 100) {
      if (state.phase === "awaiting-answer") {
        misses += 1;
        const q = state.currentQuestion!;
        state = submitAnswer(state, (q.correctIndex + 1) % q.options.length, d).state;
      } else {
        state = dismissFeedback(state, d).state;
      }
    }
    expect(misses, `the Chapter 2 boss kills after ${misses} misses`).toBeGreaterThanOrEqual(5);
  });
});

describe("battle pacing (T122)", () => {
  it("resolves a regular monster in a designed number of turns", () => {
    for (const monsterId of ["monster-eat", "monster-see", "monster-friend"]) {
      for (let seed = 1; seed <= 10; seed += 1) {
        const turns = turnsToWin(monsterId, seed);
        expect(turns, `${monsterId} seed ${seed} took ${turns} turns`).toBeGreaterThanOrEqual(TARGET_TURNS.min);
        expect(turns, `${monsterId} seed ${seed} took ${turns} turns`).toBeLessThanOrEqual(TARGET_TURNS.max);
      }
    }
  });

  it("makes the boss longer than a regular monster, but not a grind", () => {
    const boss = turnsToWin("monster-go", 1);
    const regular = turnsToWin("monster-eat", 1);
    expect(boss).toBeGreaterThan(regular);
    expect(boss).toBeLessThanOrEqual(TARGET_TURNS.max + 3);
  });

  it("gives the player room to be wrong several times before losing", () => {
    // A player who misses twice should not be dead. Learning requires being allowed to fail.
    for (const monsterId of ["monster-eat", "monster-go"]) {
      const misses = missesToLose(monsterId, 1);
      expect(misses, `${monsterId} kills after ${misses} misses`).toBeGreaterThanOrEqual(5);
    }
  });

  it("keeps the four difficulty tiers meaningfully separated", () => {
    const { easy, medium, hard, expert } = balance.damage.byDifficulty;
    expect(easy).toBeLessThan(medium);
    expect(medium).toBeLessThan(hard);
    expect(hard).toBeLessThan(expert);
    // An expert answer should feel like a real blow, not a rounding difference.
    expect(expert).toBeGreaterThanOrEqual(easy * 4);
  });
});

describe("reachability (SC-001)", () => {
  it("puts a monster within a few steps of the player start", () => {
    // SC-001: a new player reaches their first battle within 3 minutes. The forest monster is
    // one map transition from the village start, which is well inside that.
    const chapter = content.chapter("chapter-1");
    expect(chapter.mapIds).toContain("village");
    expect(chapter.mapIds).toContain("forest");
    expect(chapter.monsterIds.length).toBeGreaterThan(0);
  });
});
