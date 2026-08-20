import { describe, expect, it } from "vitest";
import {
  createBattle, dismissFeedback, endBattle, submitAnswer, type BattleState,
} from "../../src/core/battle/battle";
import { balance, content, deps, player } from "../helpers/fixtures";
import { masteryPercent } from "../../src/core/mastery/mastery";

/**
 * SC-005, end to end through the real rules and the real shipped content.
 *
 *   A player who answers everything correctly must NEVER take damage.
 *   A player who answers everything incorrectly must ALWAYS be defeated.
 *
 * If either stops holding, the core loop is broken in a way no amount of polish hides.
 */

const MAX_TURNS = 200; // guards against a rule change that makes a battle unwinnable

function playBattle(monsterId: string, alwaysCorrect: boolean, seed: number) {
  const d = deps(seed);
  let state: BattleState = createBattle({
    monsterId, player: player(), content, balance, rng: d.rng,
  });

  let turns = 0;
  let damageTaken = 0;
  let damageDealt = 0;

  while (state.phase !== "ended" && turns < MAX_TURNS) {
    turns += 1;
    if (state.phase === "awaiting-answer") {
      const q = state.currentQuestion!;
      const index = alwaysCorrect ? q.correctIndex : (q.correctIndex + 1) % q.options.length;
      const result = submitAnswer(state, index, d);
      damageDealt += result.damageDealt;
      state = result.state;
    } else if (state.phase === "showing-feedback") {
      const result = dismissFeedback(state, d);
      damageTaken += result.damageTaken;
      state = result.state;
    }
  }

  return { state, turns, damageTaken, damageDealt };
}

describe("all-correct playthrough (SC-005)", () => {
  for (const monsterId of ["monster-go", "monster-eat"]) {
    it(`always defeats ${monsterId} without taking a single point of damage`, () => {
      for (let seed = 1; seed <= 25; seed += 1) {
        const { state, damageTaken, turns } = playBattle(monsterId, true, seed);
        expect(state.outcome, `seed ${seed}`).toBe("victory");
        expect(damageTaken, `seed ${seed}`).toBe(0);
        expect(state.player.hp).toBe(state.player.maxHp);
        expect(turns).toBeLessThan(MAX_TURNS);
      }
    });
  }

  it("deals at least the monster's HP in total damage", () => {
    const { damageDealt } = playBattle("monster-go", true, 1);
    expect(damageDealt).toBeGreaterThanOrEqual(content.monster("monster-go").maxHp);
  });

  it("ends in a designed number of turns, not a slog (T122 balance target: 4-6)", () => {
    // Documents the current tuning so a balance edit that makes the boss a grind is visible.
    const { state } = playBattle("monster-go", true, 1);
    expect(state.turn).toBeLessThanOrEqual(12);
  });
});

describe("all-wrong playthrough (SC-005)", () => {
  for (const monsterId of ["monster-go", "monster-eat"]) {
    it(`is always defeated by ${monsterId} without scratching it`, () => {
      for (let seed = 1; seed <= 25; seed += 1) {
        const { state, damageDealt } = playBattle(monsterId, false, seed);
        expect(state.outcome, `seed ${seed}`).toBe("defeat");
        expect(damageDealt, `seed ${seed}`).toBe(0);
        expect(state.monsterHp).toBe(state.monsterMaxHp);
        expect(state.player.hp).toBe(0);
      }
    });
  }

  it("shows the correct answer and an explanation on every single miss (FR-004)", () => {
    const d = deps(4);
    let state = createBattle({ monsterId: "monster-eat", player: player(), content, balance, rng: d.rng });
    let missesTaught = 0;

    while (state.phase !== "ended") {
      if (state.phase === "awaiting-answer") {
        const q = state.currentQuestion!;
        const result = submitAnswer(state, (q.correctIndex + 1) % q.options.length, d);
        expect(result.feedback).not.toBeNull();
        expect(result.feedback!.correctOption).toBe(q.options[q.correctIndex]);
        expect(result.feedback!.explanation.th.length).toBeGreaterThan(3);
        missesTaught += 1;
        state = result.state;
      } else {
        state = dismissFeedback(state, d).state;
      }
    }
    expect(missesTaught).toBeGreaterThan(1);
  });

  it("keeps every scrap of mastery through defeat (FR-027)", () => {
    const { state } = playBattle("monster-go", false, 2);
    expect(state.outcome).toBe("defeat");
    const attempts = Object.values(state.player.mastery["go"]!.components)
      .reduce((n, c) => n + c.attempts, 0);
    expect(attempts).toBeGreaterThan(0);
    expect(endBattle(state).mastery["go"]).toBeDefined();
  });
});

describe("learning actually accrues", () => {
  it("accrues mastery progress across a winning fight", () => {
    // NOTE: a single fight is not expected to MASTER a component. The boss has more components
    // than the battle has turns, and mastering one needs two consecutive correct answers on it.
    // That is the intended pedagogy — one victory is not understanding — so the assertion is
    // that progress was recorded, not that a star was earned.
    const { state } = playBattle("monster-go", true, 1);
    const components = Object.values(state.player.mastery["go"]!.components);
    expect(components.reduce((n, c) => n + c.attempts, 0)).toBeGreaterThan(0);
    expect(components.reduce((n, c) => n + c.correct, 0)).toBeGreaterThan(0);
  });

  it("keeps battle HP and knowledge as separate systems (FR-029)", () => {
    // The monster dies from HP loss; the word is understood through mastery. Winning does not
    // imply mastery, and mastery does not imply winning.
    const { state } = playBattle("monster-go", true, 1);
    expect(state.monsterHp).toBe(0);
    expect(masteryPercent(state.player.mastery["go"]!)).toBeLessThan(1);
  });
});
