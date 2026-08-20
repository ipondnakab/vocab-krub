import type { BalanceConfig, Localized, Question } from "../../content/schemas";
import type { ContentIndex } from "../content/loadContent";
import { initMastery, isWordMastered, recordAnswer } from "../mastery/mastery";
import type { ChapterProgress, PlayerState } from "../player/playerState";
import { isGrammarLearned } from "../progression/grammar";
import { correctOptionText, gradeAnswer, presentQuestion, type PresentedQuestion } from "../questions/present";
import type { Rng } from "../rng/rng";
import type { MasteryEvent } from "../battle/battle";

/**
 * The chapter challenge (FR-045 … FR-048).
 *
 * A guard at a gate, not an exam screen. The player is asked what the chapter taught, and passing
 * opens the gate.
 *
 * NOTE WHAT IS ABSENT: there is no HP field on ChallengeState and no damage function in this
 * module. FR-047 says the challenge cannot hurt the player, and the cheapest way to guarantee
 * that forever is to leave out the machinery entirely — a future change cannot accidentally
 * reintroduce damage here, because there is nothing to reintroduce it into.
 */

export interface ChallengeAnswer {
  questionId: string;
  /** Kept for the weakest-topic report the guard gives on failure. */
  grammarTopicId: string | null;
  wordId: string;
  correct: boolean;
}

export interface ChallengeFeedback {
  correct: boolean;
  correctOption: string;
  explanation: Localized;
}

export interface ChallengeState {
  chapterId: string;
  questions: PresentedQuestion[];
  index: number;
  answers: ChallengeAnswer[];
  feedback: ChallengeFeedback | null;
  outcome: "passed" | "failed" | null;
  masteryEvents: MasteryEvent[];
}

export interface ChallengeResult {
  player: PlayerState;
  passed: boolean;
  score: number;
  /** Named by the guard, in character, when the player falls short (US6 scenario 4). */
  weakestTopics: string[];
  rewardGranted: boolean;
}

export function chapterProgressOf(player: PlayerState, chapterId: string): ChapterProgress {
  return (
    player.chapterProgress[chapterId] ?? {
      chapterId,
      bossDefeated: false,
      challengeAttempts: 0,
      challengeBestScore: 0,
      completed: false,
    }
  );
}

/** FR-045: the gate stays shut until the chapter boss has been restored. */
export function isChallengeUnlocked(player: PlayerState, chapterId: string): boolean {
  return chapterProgressOf(player, chapterId).bossDefeated;
}

export function recordBossDefeated(player: PlayerState, chapterId: string): PlayerState {
  const progress = chapterProgressOf(player, chapterId);
  if (progress.bossDefeated) return player;
  return {
    ...player,
    chapterProgress: { ...player.chapterProgress, [chapterId]: { ...progress, bossDefeated: true } },
  };
}

/** Which chapter a monster belongs to, so defeating a boss updates the right progress record. */
export function chapterOfMonster(monsterId: string, content: ContentIndex): string | null {
  return content.chapters.find((c) => c.monsterIds.includes(monsterId))?.id ?? null;
}

/**
 * FR-046: questions come only from this chapter's declared vocabulary and grammar.
 *
 * Anything gated behind grammar the player never learned is excluded — the guard tests what the
 * chapter taught, not what it withheld.
 */
export function challengePool(player: PlayerState, chapterId: string, content: ContentIndex): Question[] {
  const chapter = content.chapter(chapterId);
  const words = new Set(chapter.vocabularyIds);
  const topics = new Set(chapter.grammarTopicIds);

  return content.questions.filter((question) => {
    if (!words.has(question.wordId)) return false;
    if (question.requiresGrammar === null) return true;
    return topics.has(question.requiresGrammar) && isGrammarLearned(player, question.requiresGrammar);
  });
}

/** FR-047: every attempt draws a fresh set, so a retry is not the same test memorised. */
export function startChallenge(input: {
  chapterId: string;
  player: PlayerState;
  content: ContentIndex;
  balance: BalanceConfig;
  rng: Rng;
}): ChallengeState {
  if (!isChallengeUnlocked(input.player, input.chapterId)) {
    throw new Error(`Challenge for '${input.chapterId}' is locked: the chapter boss is undefeated`);
  }

  const chapter = input.content.chapter(input.chapterId);
  const pool = challengePool(input.player, input.chapterId, input.content);
  if (pool.length === 0) {
    throw new Error(`Challenge for '${input.chapterId}' has no eligible questions`);
  }

  // Draw without replacement where possible; fall back to reuse only if the pool is short.
  const shuffled = input.rng.shuffle(pool);
  const questions: Question[] = [];
  for (let i = 0; i < chapter.challenge.questionCount; i += 1) {
    questions.push(shuffled[i % shuffled.length] as Question);
  }

  return {
    chapterId: input.chapterId,
    questions: questions.map((q) => presentQuestion(q, input.rng)),
    index: 0,
    answers: [],
    feedback: null,
    outcome: null,
    masteryEvents: [],
  };
}

export function currentChallengeQuestion(state: ChallengeState): PresentedQuestion | null {
  return state.questions[state.index] ?? null;
}

/**
 * Answers one challenge question.
 *
 * Mastery is recorded exactly as it is in battle and in NPC practice — an answer is an answer.
 * No HP moves, because there is none here to move.
 */
export function answerChallenge(
  state: ChallengeState,
  optionIndex: number,
  player: PlayerState,
  content: ContentIndex,
  balance: BalanceConfig,
): { state: ChallengeState; player: PlayerState; correct: boolean } {
  if (state.outcome !== null) throw new Error("answerChallenge called after the challenge ended");
  const question = currentChallengeQuestion(state);
  if (!question) throw new Error("answerChallenge called with no question remaining");
  if (state.feedback !== null) throw new Error("answerChallenge called while feedback is showing");

  const correct = gradeAnswer(question, optionIndex);

  const existing = player.mastery[question.wordId] ?? initMastery(content.word(question.wordId));
  const wasMastered = existing.components[question.component]?.mastered ?? false;
  const wordWasMastered = isWordMastered(existing);
  const updated = recordAnswer(existing, question.component, correct, balance);
  const nowMastered = updated.components[question.component]?.mastered ?? false;

  const event: MasteryEvent = {
    wordId: question.wordId,
    componentId: question.component,
    correct,
    masteredNow: !wasMastered && nowMastered,
    demoted: wasMastered && !nowMastered,
    wordMasteredNow: !wordWasMastered && isWordMastered(updated),
  };

  return {
    state: {
      ...state,
      answers: [...state.answers, {
        questionId: question.questionId,
        grammarTopicId: question.requiresGrammar,
        wordId: question.wordId,
        correct,
      }],
      feedback: { correct, correctOption: correctOptionText(question), explanation: question.explanation },
      masteryEvents: [...state.masteryEvents, event],
    },
    player: { ...player, mastery: { ...player.mastery, [question.wordId]: updated } },
    correct,
  };
}

/** Moves past the feedback to the next question, or to the end. */
export function advanceChallenge(state: ChallengeState): ChallengeState {
  if (state.feedback === null) return state;
  return { ...state, feedback: null, index: state.index + 1 };
}

export function isChallengeComplete(state: ChallengeState): boolean {
  return state.answers.length >= state.questions.length;
}

export function challengeScore(state: ChallengeState): number {
  if (state.answers.length === 0) return 0;
  return state.answers.filter((a) => a.correct).length / state.questions.length;
}

/**
 * Topics the player got wrong most often, worst first.
 *
 * Reported so the guard can name them in character rather than saying "you failed" — a failure
 * that does not tell you what to study is just a wall.
 */
export function weakestTopics(state: ChallengeState): string[] {
  const misses = new Map<string, number>();
  for (const answer of state.answers) {
    if (answer.correct) continue;
    const key = answer.grammarTopicId ?? `word:${answer.wordId}`;
    misses.set(key, (misses.get(key) ?? 0) + 1);
  }
  return [...misses.entries()].sort((a, b) => b[1] - a[1]).map(([key]) => key);
}

/**
 * Scores the attempt and, ONLY on a pass, completes the chapter and grants its reward
 * (FR-048). Failure keeps every scrap of mastery earned during the attempt.
 */
export function finishChallenge(
  state: ChallengeState,
  player: PlayerState,
  content: ContentIndex,
  balance: BalanceConfig,
): ChallengeResult {
  const chapter = content.chapter(state.chapterId);
  const threshold = chapter.challenge.passThreshold ?? balance.challenge.defaultPassThreshold;
  const score = challengeScore(state);
  const passed = score >= threshold;

  const progress = chapterProgressOf(player, state.chapterId);
  const nextProgress: ChapterProgress = {
    ...progress,
    challengeAttempts: progress.challengeAttempts + 1,
    challengeBestScore: Math.max(progress.challengeBestScore, score),
    completed: progress.completed || passed,
  };

  let next: PlayerState = {
    ...player,
    chapterProgress: { ...player.chapterProgress, [state.chapterId]: nextProgress },
  };

  let rewardGranted = false;
  if (passed && !progress.completed) {
    next = {
      ...next,
      xp: next.xp + chapter.completionReward.xp,
      gold: next.gold + chapter.completionReward.gold,
      inventory: chapter.completionReward.drops.reduce((inventory, drop) => {
        // Chapter rewards are guaranteed, not rolled — they are the payoff for finishing.
        if (inventory.some((entry) => entry.itemId === drop.itemId)) return inventory;
        return [...inventory, { itemId: drop.itemId, quantity: 1 }];
      }, next.inventory),
    };
    rewardGranted = true;
  }

  return { player: next, passed, score, weakestTopics: weakestTopics(state), rewardGranted };
}
