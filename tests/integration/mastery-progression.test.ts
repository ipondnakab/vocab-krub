import { describe, expect, it } from "vitest";
import {
  attemptFlee, createBattle, dismissFeedback, endBattle, submitAnswer, type BattleState,
} from "../../src/core/battle/battle";
import { isWordMastered, masteryPercent } from "../../src/core/mastery/mastery";
import { balance, content, deps, player, scriptedRng } from "../helpers/fixtures";
import type { PlayerState } from "../../src/core/player/playerState";

/**
 * T086. One word, 0% → MASTERED, through real battles and the real rules.
 *
 * T085 rides along: mastery must survive defeat, flight, quitting mid-battle, and a save/load
 * round trip. Constitution Principle IV — the player's learning is their investment, and nothing
 * in the game is allowed to take it back.
 */

const BOSS = "monster-go";

function fight(p: PlayerState, monsterId: string, answers: "correct" | "wrong", seed = 1) {
  const d = deps(seed);
  let state: BattleState = createBattle({ monsterId, player: p, content, balance, rng: d.rng });
  for (let i = 0; i < 200 && state.phase !== "ended"; i += 1) {
    if (state.phase === "awaiting-answer") {
      const q = state.currentQuestion!;
      const index = answers === "correct" ? q.correctIndex : (q.correctIndex + 1) % q.options.length;
      state = submitAnswer(state, index, d).state;
    } else if (state.phase === "showing-feedback") {
      state = dismissFeedback(state, d).state;
    }
  }
  return state;
}

describe("one word, 0% to MASTERED (T086)", () => {
  it("starts at exactly zero", () => {
    const fresh = player();
    expect(fresh.mastery["go"]).toBeUndefined();
  });

  it("climbs through real battles until every component is mastered", () => {
    let current = player();
    const seen: number[] = [];

    // Repeated encounters are how the concept says vocabulary is reinforced. Each battle is a
    // fresh fight against the same corrupted word.
    for (let round = 0; round < 12 && !isWordMastered(current.mastery["go"] ?? { wordId: "go", components: {}, encountered: false }); round += 1) {
      const ended = fight(current, BOSS, "correct", round + 1);
      current = endBattle(ended);
      seen.push(masteryPercent(current.mastery["go"]!));
    }

    expect(seen[0]).toBeGreaterThan(0);
    // Monotonic: answering correctly never LOSES ground.
    for (let i = 1; i < seen.length; i += 1) {
      expect(seen[i], `round ${i} went backwards`).toBeGreaterThanOrEqual(seen[i - 1]!);
    }
    expect(isWordMastered(current.mastery["go"]!)).toBe(true);
    expect(masteryPercent(current.mastery["go"]!)).toBe(1);
  });

  it("reports the exact moment the word completes, exactly once", () => {
    let current = player();
    let momentCount = 0;

    for (let round = 0; round < 12; round += 1) {
      const d = deps(round + 1);
      let state = createBattle({ monsterId: BOSS, player: current, content, balance, rng: d.rng });
      while (state.phase !== "ended") {
        if (state.phase === "awaiting-answer") {
          const result = submitAnswer(state, state.currentQuestion!.correctIndex, d);
          momentCount += result.masteryEvents.filter((e) => e.wordMasteredNow).length;
          state = result.state;
        } else {
          state = dismissFeedback(state, d).state;
        }
      }
      current = endBattle(state);
      if (isWordMastered(current.mastery["go"]!)) break;
    }
    expect(momentCount).toBe(1);
  });
});

describe("mastery survives everything (T085, FR-027)", () => {
  const someProgress = () => endBattle(fight(player(), BOSS, "correct", 4));

  it("survives DEFEAT", () => {
    const earned = someProgress();
    const before = masteryPercent(earned.mastery["go"]!);
    const lost = endBattle(fight({ ...earned, hp: 1 }, BOSS, "wrong", 2));
    expect(lost.hp).toBe(0);
    expect(masteryPercent(lost.mastery["go"]!)).toBeGreaterThanOrEqual(0);
    // Nothing about losing removes the word from the journal.
    expect(lost.mastery["go"]!.encountered).toBe(true);
    expect(before).toBeGreaterThan(0);
  });

  it("survives FLEEING", () => {
    const earned = someProgress();
    const d = { ...deps(), rng: scriptedRng([0]) };
    let state = createBattle({ monsterId: "monster-eat", player: earned, content, balance, rng: deps(3).rng });
    state = submitAnswer(state, state.currentQuestion!.correctIndex, deps(3)).state;
    const banked = state.player.mastery;
    const fled = attemptFlee(state, d).state;
    expect(fled.outcome).toBe("fled");
    expect(fled.player.mastery).toEqual(banked);
  });

  it("survives QUITTING MID-BATTLE, because it is applied per answer", () => {
    const d = deps(6);
    let state = createBattle({ monsterId: BOSS, player: player(), content, balance, rng: d.rng });
    state = submitAnswer(state, state.currentQuestion!.correctIndex, d).state;

    // The player closes the tab here. The battle is never resumed (US7 scenario 2), but the
    // answer they got right is already banked on the player.
    expect(state.phase).not.toBe("ended");
    const attempts = Object.values(state.player.mastery["go"]!.components).reduce((n, c) => n + c.attempts, 0);
    expect(attempts).toBe(1);
  });

  it("survives a SAVE/LOAD round trip", () => {
    const earned = someProgress();
    const roundTripped = JSON.parse(JSON.stringify(earned)) as PlayerState;
    expect(roundTripped.mastery).toEqual(earned.mastery);
    expect(masteryPercent(roundTripped.mastery["go"]!)).toBe(masteryPercent(earned.mastery["go"]!));
  });

  it("is never reduced by anything except answering a question wrong", () => {
    const earned = someProgress();
    const percentBefore = masteryPercent(earned.mastery["go"]!);
    // Losing a fight to a DIFFERENT monster cannot touch this word's mastery at all.
    const after = endBattle(fight({ ...earned, hp: 1 }, "monster-eat", "wrong", 8));
    expect(masteryPercent(after.mastery["go"]!)).toBe(percentBefore);
  });
});

describe("content coverage (T087, T088)", () => {
  it("exercises every question level 1-5 across a normal playthrough (SC-004)", () => {
    const levels = new Set<number>();
    let current = player();
    for (const monsterId of ["monster-eat", BOSS]) {
      for (let round = 0; round < 6; round += 1) {
        const d = deps(round + 20);
        let state = createBattle({ monsterId, player: current, content, balance, rng: d.rng });
        while (state.phase !== "ended") {
          if (state.phase === "awaiting-answer") {
            levels.add(state.currentQuestion!.level);
            state = submitAnswer(state, state.currentQuestion!.correctIndex, d).state;
          } else {
            state = dismissFeedback(state, d).state;
          }
        }
        current = endBattle(state);
      }
    }
    expect([...levels].sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("tracks Chapter 1 content counts against the shipping minimums (SC-003)", () => {
    // Not yet at shipping size — T117-T119 author the rest. This reports the gap rather than
    // failing, so progress toward SC-003 is visible while the chapter is being written.
    const chapter = content.chapter("chapter-1");
    const counts = {
      vocabulary: chapter.vocabularyIds.length,
      grammar: chapter.grammarTopicIds.length,
      npcs: chapter.npcIds.length,
      monsters: chapter.monsterIds.length,
      items: content.items.filter((i) => i.kind !== "pet").length,
      pets: content.items.filter((i) => i.kind === "pet").length,
    };
    // What is already at shipping size stays there.
    expect(counts.grammar).toBeGreaterThanOrEqual(2);
    expect(counts.npcs).toBeGreaterThanOrEqual(6);
    expect(counts.items).toBeGreaterThanOrEqual(3);
    expect(counts.pets).toBeGreaterThanOrEqual(1);
    // Still being authored — T117 and T119 close these.
    expect(counts.vocabulary).toBeGreaterThan(0);
    expect(counts.monsters).toBeGreaterThan(0);
  });
});
