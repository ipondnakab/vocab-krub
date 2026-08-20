import type { DifficultyTier, Localized, Question, QuestionLevel } from "../../content/schemas/index";
import type { Rng } from "../rng/rng";

/**
 * A question as the player sees it: options shuffled, correct index remapped (FR-021).
 *
 * Renderers receive THIS, never the authored `Question`. The authored `correctIndex` is always
 * 0 in our content — if the raw question reached the UI, the answer would be the first option
 * every single time.
 *
 * Honest limit: `correctIndex` is present here because core grades against it and because
 * BattleState must stay serialisable. A determined player can read it out of memory. Shuffling
 * satisfies FR-021 (position is unpredictable); true anti-cheat needs server authority, which
 * is a Stage 2 consideration recorded in research R-017.
 */
export interface PresentedQuestion {
  questionId: string;
  wordId: string;
  component: string;
  level: QuestionLevel;
  difficulty: DifficultyTier;
  prompt: Localized;
  explanation: Localized;
  /** Shuffled. */
  options: readonly string[];
  /** Index into the SHUFFLED options. */
  correctIndex: number;
  requiresGrammar: string | null;
}

export function presentQuestion(question: Question, rng: Rng): PresentedQuestion {
  const correctOption = question.options[question.correctIndex];
  if (correctOption === undefined) {
    throw new Error(`Question '${question.id}' has correctIndex out of range`);
  }

  const options = rng.shuffle(question.options);
  const correctIndex = options.indexOf(correctOption);

  return {
    questionId: question.id,
    wordId: question.wordId,
    component: question.component,
    level: question.level,
    difficulty: question.difficulty,
    prompt: question.prompt,
    explanation: question.explanation,
    options,
    correctIndex,
    requiresGrammar: question.requiresGrammar,
  };
}

export function gradeAnswer(question: PresentedQuestion, chosenIndex: number): boolean {
  return chosenIndex === question.correctIndex;
}

export function correctOptionText(question: PresentedQuestion): string {
  const option = question.options[question.correctIndex];
  if (option === undefined) throw new Error(`PresentedQuestion '${question.questionId}' is malformed`);
  return option;
}
