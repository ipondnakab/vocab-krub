import { describe, expect, it } from "vitest";
import {
  advanceChallenge, answerChallenge, challengePool, challengeScore, chapterOfMonster,
  chapterProgressOf, currentChallengeQuestion, finishChallenge, isChallengeComplete,
  isChallengeUnlocked, recordBossDefeated, startChallenge, weakestTopics, type ChallengeState,
} from "../../src/core/chapter/challenge";
import { balance, content, player, rng } from "../helpers/fixtures";
import type { PlayerState } from "../../src/core/player/playerState";

const CHAPTER = "chapter-1";

const ready = (over: Partial<PlayerState> = {}): PlayerState =>
  recordBossDefeated(player(over), CHAPTER);

const open = (p: PlayerState = ready(), seed = 4): ChallengeState =>
  startChallenge({ chapterId: CHAPTER, player: p, content, balance, rng: rng(seed) });

/** Plays the whole challenge, getting `correctCount` of them right. */
function play(state: ChallengeState, p: PlayerState, correctCount: number) {
  let s = state;
  let current = p;
  let right = 0;
  while (!isChallengeComplete(s)) {
    const q = currentChallengeQuestion(s)!;
    const wantCorrect = right < correctCount;
    const index = wantCorrect ? q.correctIndex : (q.correctIndex + 1) % q.options.length;
    if (wantCorrect) right += 1;
    const result = answerChallenge(s, index, current, content, balance);
    s = advanceChallenge(result.state);
    current = result.player;
  }
  return { state: s, player: current };
}

describe("the gate stays shut until the boss falls (FR-045)", () => {
  it("is locked before the boss is defeated", () => {
    expect(isChallengeUnlocked(player(), CHAPTER)).toBe(false);
    expect(() => open(player())).toThrow(/locked/);
  });

  it("unlocks once the boss is defeated", () => {
    expect(isChallengeUnlocked(ready(), CHAPTER)).toBe(true);
    expect(() => open()).not.toThrow();
  });

  it("maps a boss monster back to its chapter", () => {
    expect(chapterOfMonster("monster-go", content)).toBe(CHAPTER);
    expect(chapterOfMonster("nope", content)).toBeNull();
  });

  it("records the boss defeat once and idempotently", () => {
    const once = recordBossDefeated(player(), CHAPTER);
    expect(recordBossDefeated(once, CHAPTER)).toBe(once);
  });
});

describe("question drawing (FR-046, FR-047)", () => {
  it("draws only from the chapter's declared vocabulary", () => {
    const chapter = content.chapter(CHAPTER);
    for (const q of open().questions) expect(chapter.vocabularyIds).toContain(q.wordId);
  });

  it("excludes questions gated behind grammar the player never learned", () => {
    const noGrammar = ready({ grammarLearned: [] });
    for (const q of challengePool(noGrammar, CHAPTER, content)) {
      expect(q.requiresGrammar).toBeNull();
    }
  });

  it("draws the configured number of questions", () => {
    expect(open().questions).toHaveLength(content.chapter(CHAPTER).challenge.questionCount);
  });

  it("draws a FRESH set for each attempt", () => {
    // A retry that is the same test memorised proves nothing.
    const first = open(ready(), 1).questions.map((q) => q.questionId).join(",");
    const second = open(ready(), 2).questions.map((q) => q.questionId).join(",");
    expect(first).not.toBe(second);
  });
});

describe("scoring (FR-047, FR-048)", () => {
  const total = content.chapter(CHAPTER).challenge.questionCount;
  const threshold = content.chapter(CHAPTER).challenge.passThreshold;
  const needed = Math.ceil(total * threshold);

  it("passes at EXACTLY the threshold", () => {
    const { state, player: after } = play(open(), ready(), needed);
    const result = finishChallenge(state, after, content, balance);
    expect(challengeScore(state)).toBeGreaterThanOrEqual(threshold);
    expect(result.passed).toBe(true);
  });

  it("fails one answer below the threshold", () => {
    const { state, player: after } = play(open(), ready(), needed - 1);
    const result = finishChallenge(state, after, content, balance);
    expect(result.passed).toBe(false);
  });

  it("completes the chapter and grants its reward ONLY on a pass", () => {
    const fail = play(open(), ready(), 0);
    const failed = finishChallenge(fail.state, fail.player, content, balance);
    expect(failed.rewardGranted).toBe(false);
    expect(chapterProgressOf(failed.player, CHAPTER).completed).toBe(false);

    const win = play(open(), ready(), total);
    const passed = finishChallenge(win.state, win.player, content, balance);
    expect(passed.rewardGranted).toBe(true);
    expect(chapterProgressOf(passed.player, CHAPTER).completed).toBe(true);
    expect(passed.player.inventory.some((e) => e.itemId === "owl")).toBe(true);
  });

  it("does not grant the chapter reward twice", () => {
    const first = play(open(), ready(), total);
    const once = finishChallenge(first.state, first.player, content, balance).player;
    const second = play(open(once), once, total);
    const twice = finishChallenge(second.state, second.player, content, balance);
    expect(twice.rewardGranted).toBe(false);
    expect(twice.player.inventory.filter((e) => e.itemId === "owl")).toHaveLength(1);
  });

  it("records attempts and keeps the best score", () => {
    const poor = play(open(), ready(), 1);
    const afterPoor = finishChallenge(poor.state, poor.player, content, balance).player;
    const good = play(open(afterPoor), afterPoor, total);
    const afterGood = finishChallenge(good.state, good.player, content, balance).player;

    const progress = chapterProgressOf(afterGood, CHAPTER);
    expect(progress.challengeAttempts).toBe(2);
    expect(progress.challengeBestScore).toBe(1);
  });

  it("allows unlimited retries", () => {
    let current = ready();
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const run = play(open(current, attempt + 1), current, 0);
      current = finishChallenge(run.state, run.player, content, balance).player;
    }
    expect(chapterProgressOf(current, CHAPTER).challengeAttempts).toBe(5);
    expect(() => open(current)).not.toThrow();
  });
});

describe("the challenge cannot hurt you (FR-047)", () => {
  it("has NO hp field on its state — enforced by the type, not by a conditional", () => {
    const state = open();
    expect(Object.keys(state)).not.toContain("hp");
    expect(Object.keys(state)).not.toContain("playerHp");
    expect(Object.keys(state)).not.toContain("damage");
  });

  it("leaves HP, gold, XP, and level untouched across a total failure", () => {
    const before = ready({ hp: 40, gold: 90, xp: 120 });
    const { player: after } = play(open(before), before, 0);
    expect(after.hp).toBe(before.hp);
    expect(after.gold).toBe(before.gold);
    expect(after.xp).toBe(before.xp);
    expect(after.level).toBe(before.level);
  });

  it("keeps every scrap of mastery earned during a FAILED attempt", () => {
    const before = ready();
    const { state, player: after } = play(open(before), before, 3);
    expect(finishChallenge(state, after, content, balance).passed).toBe(false);
    const attempts = Object.values(after.mastery).flatMap((m) => Object.values(m.components))
      .reduce((n, c) => n + c.attempts, 0);
    expect(attempts).toBeGreaterThan(0);
  });
});

describe("the guard names what you struggled with (US6 scenario 4)", () => {
  it("reports the most-missed topics, worst first", () => {
    const before = ready();
    const { state } = play(open(before), before, 0);
    const weak = weakestTopics(state);
    expect(weak.length).toBeGreaterThan(0);
  });

  it("reports nothing when everything was answered correctly", () => {
    const before = ready();
    const total = content.chapter(CHAPTER).challenge.questionCount;
    const { state } = play(open(before), before, total);
    expect(weakestTopics(state)).toEqual([]);
  });
});

describe("flow guards", () => {
  it("refuses a second answer while feedback is showing", () => {
    const state = open();
    const q = currentChallengeQuestion(state)!;
    const result = answerChallenge(state, q.correctIndex, ready(), content, balance);
    expect(() => answerChallenge(result.state, 0, result.player, content, balance)).toThrow(/feedback/);
  });

  it("shows the correct answer and explanation after every answer", () => {
    const state = open();
    const q = currentChallengeQuestion(state)!;
    const result = answerChallenge(state, (q.correctIndex + 1) % 4, ready(), content, balance);
    expect(result.state.feedback?.correctOption).toBe(q.options[q.correctIndex]);
    expect(result.state.feedback?.explanation.th.length).toBeGreaterThan(0);
  });
});
