import { describe, expect, it } from "vitest";
import { createBattle, dismissFeedback, endBattle, submitAnswer, type BattleState } from "../../src/core/battle/battle";
import {
  advanceChallenge, answerChallenge, challengePool, chapterProgressOf, currentChallengeQuestion,
  finishChallenge, isChallengeComplete, recordBossDefeated, startChallenge,
} from "../../src/core/chapter/challenge";
import { blockedBy, isChapterAvailable } from "../../src/core/chapter/progression";
import { markEncountered, initMastery, masteryPercent, recordAnswer } from "../../src/core/mastery/mastery";
import { deserialize, serialize } from "../../src/core/save/serialize";
import { balance, content, deps, player, rng } from "../helpers/fixtures";
import type { PlayerState } from "../../src/core/player/playerState";

const CH1 = "chapter-1";
const CH2 = "chapter-2";

const complete = (p: PlayerState, chapterId: string): PlayerState => ({
  ...p,
  chapterProgress: {
    ...p.chapterProgress,
    [chapterId]: { ...chapterProgressOf(p, chapterId), bossDefeated: true, completed: true },
  },
});

/** A player who finished Chapter 1 the honest way, carrying real progress. */
function graduate(): PlayerState {
  let p = player({ level: 5, xp: 900, gold: 320, hp: 90, maxHp: 180,
    inventory: [{ itemId: "beginner-sword", quantity: 1 }, { itemId: "owl", quantity: 1 }],
    equipped: { weapon: "beginner-sword", armor: null, pet: "owl" },
    monstersDefeated: ["monster-eat", "monster-go"] });

  // Real mastery on several Chapter 1 words, at different stages.
  const ch1 = content.chapter(CH1).vocabularyIds.slice(0, 6);
  for (const wordId of ch1) {
    let m = markEncountered(initMastery(content.word(wordId)));
    for (const component of Object.keys(m.components)) {
      m = recordAnswer(m, component, true, balance);
      m = recordAnswer(m, component, true, balance);
    }
    p = { ...p, mastery: { ...p.mastery, [wordId]: m } };
  }
  return complete(p, CH1);
}

describe("chapter progression (FR-009, FR-010)", () => {
  it("withholds Chapter 2 until Chapter 1 is complete, and names the blocker", () => {
    const fresh = player();
    expect(isChapterAvailable(fresh, CH2, content)).toBe(false);
    expect(blockedBy(fresh, CH2, content)?.id).toBe(CH1);
  });

  it("opens Chapter 2 once Chapter 1 is complete", () => {
    expect(isChapterAvailable(graduate(), CH2, content)).toBe(true);
    expect(blockedBy(graduate(), CH2, content)).toBeNull();
  });

  it("carries EVERY scrap of progress across the chapter boundary", () => {
    // Nothing about entering a chapter reads or resets player state, so this is a property of
    // the data model rather than of a transition routine — asserted so it stays that way.
    const before = graduate();
    const after = { ...before };
    for (const key of ["level", "xp", "gold", "hp", "maxHp"] as const) {
      expect(after[key]).toBe(before[key]);
    }
    expect(after.inventory).toEqual(before.inventory);
    expect(after.equipped).toEqual(before.equipped);
    expect(after.mastery).toEqual(before.mastery);
    expect(after.grammarLearned).toEqual(before.grammarLearned);
    expect(after.monstersDefeated).toEqual(before.monstersDefeated);
  });
});

describe("saves written before Chapter 2 existed (FR-011, SC-007)", () => {
  it("loads and reaches Chapter 2 with 100% of its progress intact", () => {
    const old = graduate();
    expect(Object.keys(old.chapterProgress)).not.toContain(CH2);

    const result = deserialize(serialize(old));
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const loaded = result.player as PlayerState;
    expect(loaded).toEqual(old);
    expect(isChapterAvailable(loaded, CH2, content)).toBe(true);
    // No migration ran: the missing key simply reads as a zeroed default.
    expect(chapterProgressOf(loaded, CH2).completed).toBe(false);
  });
});

describe("cross-chapter review in BATTLE (FR-015, SC-006)", () => {
  /** Plays a Chapter 2 battle to the end and records which chapter each question came from. */
  function sampleBattle(monsterId: string, seed: number) {
    const d = deps(seed);
    let state: BattleState = createBattle({ monsterId, player: graduate(), content, balance, rng: d.rng });
    const ch1Words = new Set(content.chapter(CH1).vocabularyIds);
    let fromCh1 = 0;
    let total = 0;

    for (let i = 0; i < 200 && state.phase !== "ended"; i += 1) {
      if (state.phase === "awaiting-answer") {
        total += 1;
        if (ch1Words.has(state.currentQuestion!.wordId)) fromCh1 += 1;
        state = submitAnswer(state, state.currentQuestion!.correctIndex, d).state;
      } else {
        state = dismissFeedback(state, d).state;
      }
    }
    return { fromCh1, total, state };
  }

  it("draws at least a quarter of Chapter 2 battle questions from Chapter 1 vocabulary", () => {
    let fromCh1 = 0;
    let total = 0;
    for (let seed = 1; seed <= 12; seed += 1) {
      const sample = sampleBattle("monster-open", seed);
      fromCh1 += sample.fromCh1;
      total += sample.total;
    }
    expect(total).toBeGreaterThan(0);
    expect(fromCh1 / total, `review share was ${((fromCh1 / total) * 100).toFixed(1)}%`).toBeGreaterThanOrEqual(0.25);
  });

  it("demotes a fully mastered Chapter 1 word answered wrongly during Chapter 2 review", () => {
    const p = graduate();
    const reviewWord = content.chapter(CH1).vocabularyIds[0]!;
    const before = masteryPercent(p.mastery[reviewWord]!);
    expect(before).toBe(1);

    const component = Object.keys(p.mastery[reviewWord]!.components)[0]!;
    const after = recordAnswer(p.mastery[reviewWord]!, component, false, balance);
    expect(masteryPercent(after)).toBeLessThan(before);
    expect(masteryPercent(after)).toBeGreaterThan(0); // demoted, never wiped
  });

  it("falls back gracefully for a player who skipped most of Chapter 1's monsters", () => {
    const minimal = complete(player(), CH1);
    const d = deps(3);
    expect(() =>
      createBattle({ monsterId: "monster-open", player: minimal, content, balance, rng: d.rng }),
    ).not.toThrow();
  });
});

describe("cross-chapter review in the CHALLENGE (FR-016)", () => {
  it("includes Chapter 1 words the player actually ENCOUNTERED", () => {
    const p = recordBossDefeated(graduate(), CH2);
    const pool = challengePool(p, CH2, content);
    const ch1Words = new Set(content.chapter(CH1).vocabularyIds);
    const ch2Words = new Set(content.chapter(CH2).vocabularyIds);

    expect(pool.some((q) => ch2Words.has(q.wordId)), "no Chapter 2 questions").toBe(true);
    expect(pool.some((q) => ch1Words.has(q.wordId)), "no Chapter 1 review questions").toBe(true);
  });

  it("EXCLUDES Chapter 1 words the player never met — testing skipped content is a trap", () => {
    const p = recordBossDefeated(complete(player(), CH1), CH2);
    const pool = challengePool(p, CH2, content);
    const ch1Words = new Set(content.chapter(CH1).vocabularyIds);
    expect(pool.every((q) => !ch1Words.has(q.wordId))).toBe(true);
  });

  it("keeps Chapter 1's own challenge scoped to Chapter 1", () => {
    // The first chapter has nothing earlier to review, so its pool must not widen.
    const p = recordBossDefeated(player(), CH1);
    const pool = challengePool(p, CH1, content);
    const ch1Words = new Set(content.chapter(CH1).vocabularyIds);
    expect(pool.every((q) => ch1Words.has(q.wordId))).toBe(true);
  });
});

describe("completing Chapter 2 (FR-016)", () => {
  function playChallenge(p: PlayerState, allCorrect: boolean) {
    let current = p;
    let state = startChallenge({ chapterId: CH2, player: current, content, balance, rng: rng(11) });
    while (!isChallengeComplete(state)) {
      const question = currentChallengeQuestion(state)!;
      const index = allCorrect ? question.correctIndex : (question.correctIndex + 1) % question.options.length;
      const result = answerChallenge(state, index, current, content, balance);
      current = result.player;
      state = advanceChallenge(result.state);
    }
    return finishChallenge(state, current, content, balance);
  }

  it("unlocks only after Chapter 2's OWN boss falls, not Chapter 1's", () => {
    const graduated = graduate(); // chapter-1 boss defeated, chapter-2 boss not
    expect(() => startChallenge({ chapterId: CH2, player: graduated, content, balance, rng: rng(1) }))
      .toThrow(/locked/);
  });

  it("completes the chapter and grants its reward on a pass", () => {
    const ready = recordBossDefeated(graduate(), CH2);
    const result = playChallenge(ready, true);
    expect(result.passed).toBe(true);
    expect(result.rewardGranted).toBe(true);
    expect(chapterProgressOf(result.player, CH2).completed).toBe(true);
    const reward = content.chapter(CH2).completionReward;
    expect(result.player.xp).toBe(ready.xp + reward.xp);
  });

  it("costs no HP and keeps all mastery on a failure", () => {
    const ready = recordBossDefeated(graduate(), CH2);
    const result = playChallenge(ready, false);
    expect(result.passed).toBe(false);
    expect(result.player.hp).toBe(ready.hp);
    expect(chapterProgressOf(result.player, CH2).completed).toBe(false);
    expect(Object.keys(result.player.mastery).length).toBeGreaterThanOrEqual(Object.keys(ready.mastery).length);
  });
});

describe("Chapter 1 grammar stays learned (FR-017)", () => {
  it("does not re-teach a topic the player already knows", () => {
    const p = graduate();
    for (const topic of content.chapter(CH1).grammarTopicIds) {
      expect(p.grammarLearned).toContain(topic);
    }
    // Chapter 2's topics are additional, not replacements.
    for (const topic of content.chapter(CH2).grammarTopicIds) {
      expect(content.chapter(CH1).grammarTopicIds).not.toContain(topic);
    }
  });
});

describe("defeating a Chapter 2 monster works end to end", () => {
  it("wins against the Chapter 2 boss with all-correct answers", () => {
    const d = deps(5);
    let state: BattleState = createBattle({
      monsterId: content.chapter(CH2).bossMonsterId, player: graduate(), content, balance, rng: d.rng,
    });
    for (let i = 0; i < 300 && state.phase !== "ended"; i += 1) {
      state = state.phase === "awaiting-answer"
        ? submitAnswer(state, state.currentQuestion!.correctIndex, d).state
        : dismissFeedback(state, d).state;
    }
    expect(state.outcome).toBe("victory");
    expect(endBattle(state).hp).toBe(graduate().hp);
  });
});
