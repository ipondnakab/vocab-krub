import { describe, expect, it } from "vitest";
import { createBattle, dismissFeedback, endBattle, submitAnswer, type BattleState } from "../../src/core/battle/battle";
import {
  advanceChallenge, answerChallenge, chapterProgressOf, currentChallengeQuestion,
  finishChallenge, isChallengeComplete, isChallengeUnlocked, recordBossDefeated, startChallenge,
} from "../../src/core/chapter/challenge";
import { balance, content, deps, player, rng } from "../helpers/fixtures";
import type { PlayerState } from "../../src/core/player/playerState";

const CHAPTER = "chapter-1";
const BOSS = "monster-go";

/** Wins a battle honestly, through the real rules. */
function defeat(monsterId: string, p: PlayerState, seed = 1): PlayerState {
  const d = deps(seed);
  let state: BattleState = createBattle({ monsterId, player: p, content, balance, rng: d.rng });
  while (state.phase !== "ended") {
    if (state.phase === "awaiting-answer") {
      state = submitAnswer(state, state.currentQuestion!.correctIndex, d).state;
    } else {
      state = dismissFeedback(state, d).state;
    }
  }
  expect(state.outcome).toBe("victory");
  return endBattle(state);
}

/**
 * T108. Boss defeated → challenge unlocked → passed → chapter complete → reward granted.
 *
 * End to end through the real rules and the real shipped content. This is the arc the vertical
 * slice exists to demonstrate.
 */
describe("completing Chapter 1", () => {
  it("runs the full arc", () => {
    // 1. The gate is shut, and cannot even be attempted.
    let current = player();
    expect(isChallengeUnlocked(current, CHAPTER)).toBe(false);
    expect(() => startChallenge({ chapterId: CHAPTER, player: current, content, balance, rng: rng(1) }))
      .toThrow(/locked/);

    // 2. Restore the chapter boss.
    current = recordBossDefeated(defeat(BOSS, current), CHAPTER);
    expect(chapterProgressOf(current, CHAPTER).bossDefeated).toBe(true);
    expect(isChallengeUnlocked(current, CHAPTER)).toBe(true);

    // 3. The guard asks, and the player answers correctly.
    let challenge = startChallenge({ chapterId: CHAPTER, player: current, content, balance, rng: rng(6) });
    while (!isChallengeComplete(challenge)) {
      const question = currentChallengeQuestion(challenge)!;
      const result = answerChallenge(challenge, question.correctIndex, current, content, balance);
      current = result.player;
      challenge = advanceChallenge(result.state);
    }

    // 4. The gate opens, the chapter completes, the reward lands.
    const scored = finishChallenge(challenge, current, content, balance);
    expect(scored.passed).toBe(true);
    expect(scored.score).toBe(1);
    expect(scored.rewardGranted).toBe(true);

    const progress = chapterProgressOf(scored.player, CHAPTER);
    expect(progress.completed).toBe(true);
    expect(progress.challengeAttempts).toBe(1);

    const reward = content.chapter(CHAPTER).completionReward;
    expect(scored.player.xp).toBe(current.xp + reward.xp);
    expect(scored.player.gold).toBe(current.gold + reward.gold);
    // The owl is the chapter reward, and it is guaranteed rather than rolled.
    expect(scored.player.inventory.some((e) => e.itemId === "owl")).toBe(true);
  });

  it("keeps the gate shut and the chapter incomplete on a failed attempt", () => {
    let current = recordBossDefeated(defeat(BOSS, player()), CHAPTER);
    let challenge = startChallenge({ chapterId: CHAPTER, player: current, content, balance, rng: rng(3) });

    while (!isChallengeComplete(challenge)) {
      const question = currentChallengeQuestion(challenge)!;
      const wrong = (question.correctIndex + 1) % question.options.length;
      const result = answerChallenge(challenge, wrong, current, content, balance);
      current = result.player;
      challenge = advanceChallenge(result.state);
    }

    const scored = finishChallenge(challenge, current, content, balance);
    expect(scored.passed).toBe(false);
    expect(scored.rewardGranted).toBe(false);
    expect(chapterProgressOf(scored.player, CHAPTER).completed).toBe(false);
    expect(scored.player.inventory.some((e) => e.itemId === "owl")).toBe(false);
    // Failing costs no HP — the challenge is a gate, not a fight (FR-047).
    expect(scored.player.hp).toBe(current.hp);
    // And the player may walk straight back and try again.
    expect(() => startChallenge({ chapterId: CHAPTER, player: scored.player, content, balance, rng: rng(9) }))
      .not.toThrow();
  });

  it("only unlocks the gate for the BOSS, not for any monster", () => {
    const afterMob = defeat("monster-eat", player());
    expect(isChallengeUnlocked(afterMob, CHAPTER)).toBe(false);
  });

  it("survives a save/load round trip mid-arc", () => {
    const afterBoss = recordBossDefeated(defeat(BOSS, player()), CHAPTER);
    const roundTripped = JSON.parse(JSON.stringify(afterBoss)) as PlayerState;
    expect(isChallengeUnlocked(roundTripped, CHAPTER)).toBe(true);
    expect(chapterProgressOf(roundTripped, CHAPTER)).toEqual(chapterProgressOf(afterBoss, CHAPTER));
  });
});
