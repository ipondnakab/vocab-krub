import type { BalanceConfig, Question } from "../../content/schemas/index";
import type { ContentIndex } from "../content/loadContent";
import type { PlayerState } from "../player/playerState";
import type { Rng } from "../rng/rng";

/**
 * Question selection (FR-013, FR-018, FR-019, FR-020, research R-004).
 *
 * Computed fresh each turn rather than pre-queued at battle start, so mastery earned on turn 2
 * changes what gets asked on turn 3. A pre-shuffled queue would keep drilling a component the
 * player just mastered.
 *
 * Three rules, one mechanism:
 *   FR-019  bias toward unmastered components of the monster's word
 *   FR-020  include review questions at a configurable proportion
 *   FR-013  never repeat consecutively, and prefer unasked questions
 */

export class NoEligibleQuestionError extends Error {
  constructor(monsterId: string, detail: string) {
    super(`No eligible question for monster '${monsterId}': ${detail}`);
    this.name = "NoEligibleQuestionError";
  }
}

export interface SelectionInput {
  monsterId: string;
  player: PlayerState;
  content: ContentIndex;
  balance: BalanceConfig;
  rng: Rng;
  askedQuestionIds: readonly string[];
  /** Excluded outright, so the same question never appears twice in a row (FR-013). */
  lastQuestionId: string | null;
}

interface Weighted {
  question: Question;
  weight: number;
}

/** FR-018: a question whose grammar the player has not learned is never asked. */
function grammarSatisfied(question: Question, player: PlayerState): boolean {
  return question.requiresGrammar === null || player.grammarLearned.includes(question.requiresGrammar);
}

function componentWeight(question: Question, player: PlayerState, balance: BalanceConfig): number {
  const mastery = player.mastery[question.wordId];
  const component = mastery?.components[question.component];
  // Unseen components are unmastered, and unmastered is what we want to drill.
  return component?.mastered
    ? balance.questions.weightMasteredComponent
    : balance.questions.weightUnmasteredComponent;
}

/**
 * Already-asked questions are DOWN-WEIGHTED, not excluded. A monster whose pool is smaller than
 * the battle is long must keep asking something; degrading gracefully beats running dry.
 */
function recencyFactor(question: Question, asked: readonly string[], balance: BalanceConfig): number {
  return asked.includes(question.id) ? balance.questions.recencyPenalty : 1;
}

function weigh(
  questions: readonly Question[],
  input: SelectionInput,
  groupShare: number,
): Weighted[] {
  const raw = questions.map((question) => ({
    question,
    weight:
      componentWeight(question, input.player, input.balance) *
      recencyFactor(question, input.askedQuestionIds, input.balance),
  }));

  // Normalise the group to its target share, so reviewProportion is honoured regardless of how
  // many questions happen to sit in each pool.
  const total = raw.reduce((sum, w) => sum + w.weight, 0);
  if (total === 0) return [];
  return raw.map((w) => ({ question: w.question, weight: (w.weight / total) * groupShare }));
}

export function eligibleQuestions(input: SelectionInput): {
  monsterPool: Question[];
  reviewPool: Question[];
} {
  const monster = input.content.monster(input.monsterId);

  const usable = (question: Question) =>
    grammarSatisfied(question, input.player) && question.id !== input.lastQuestionId;

  const monsterPool = monster.questionPoolIds
    .map((id) => input.content.question(id))
    .filter(usable);

  // Review pool: words the player has already met, excluding this monster's own word.
  const reviewPool = Object.values(input.player.mastery)
    .filter((m) => m.encountered && m.wordId !== monster.wordId)
    .flatMap((m) => input.content.questionsForWord(m.wordId))
    .filter(usable);

  return { monsterPool, reviewPool };
}

export function selectQuestion(input: SelectionInput): Question {
  const { monsterPool, reviewPool } = eligibleQuestions(input);

  if (monsterPool.length === 0 && reviewPool.length === 0) {
    // Content validation already proved every monster has questions, so reaching here means the
    // player has learned no grammar and every question requires some. Throwing names the cause
    // instead of leaving a battle screen with no question on it.
    throw new NoEligibleQuestionError(
      input.monsterId,
      "every question is gated behind grammar the player has not learned yet",
    );
  }

  const share = input.balance.questions.reviewProportion;
  // When one pool is empty the other takes the whole draw — FR-020's graceful fallback.
  const reviewShare = monsterPool.length === 0 ? 1 : reviewPool.length === 0 ? 0 : share;

  const weighted = [
    ...weigh(monsterPool, input, 1 - reviewShare),
    ...weigh(reviewPool, input, reviewShare),
  ];

  return weightedPick(weighted, input.rng);
}

function weightedPick(weighted: readonly Weighted[], rng: Rng): Question {
  const total = weighted.reduce((sum, w) => sum + w.weight, 0);
  if (total <= 0) {
    const first = weighted[0];
    if (!first) throw new Error("weightedPick called with an empty pool");
    return first.question;
  }

  let roll = rng.next() * total;
  for (const entry of weighted) {
    roll -= entry.weight;
    if (roll < 0) return entry.question;
  }
  // Floating-point drift only; the last entry is the correct fallback.
  return (weighted[weighted.length - 1] as Weighted).question;
}
