import { z } from "zod";
import { componentId, difficultyTier, identifier, localized, targetText } from "./common.js";

/**
 * Question levels 1–5 (FR-015): meaning, recognition, word form, fill-in-the-blank, context.
 *
 * Level 6 (sentence creation) is CUT from the MVP (FR-016). It is excluded here as an explicit
 * union of literals rather than `min(1).max(5)` so that authoring `"level": 6` produces an
 * error naming the allowed values — and so that "no partial level 6" is enforced by the type,
 * not by anyone's discipline.
 */
export const questionLevelSchema = z.union([
  z.literal(1),
  z.literal(2),
  z.literal(3),
  z.literal(4),
  z.literal(5),
]);

export const OPTIONS_PER_QUESTION = 4;

export const questionSchema = z.strictObject({
  id: identifier(),
  wordId: identifier(),
  /** Which mastery component this exercises. Must be one of the word's derived components. */
  component: componentId(),
  level: questionLevelSchema,
  /** Drives damage (R-006). Independent of `level`. */
  difficulty: difficultyTier(),
  /** Gates eligibility until the player has learned this topic (FR-018). */
  requiresGrammar: identifier().nullable(),
  /** The question as asked. Instructional — localized. */
  prompt: localized(),
  /** English under test — never translated. Presentation shuffles these (FR-021). */
  options: z
    .array(targetText())
    .length(OPTIONS_PER_QUESTION, `a question must have exactly ${OPTIONS_PER_QUESTION} options`),
  /** Index into `options` AS AUTHORED. */
  correctIndex: z.number().int().min(0).max(OPTIONS_PER_QUESTION - 1),
  /** Shown after a wrong answer (FR-004). Required — a miss must always teach. */
  explanation: localized(),
});

export const questionsSchema = z.strictObject({
  questions: z.array(questionSchema),
});

export type Question = z.infer<typeof questionSchema>;
export type QuestionLevel = z.infer<typeof questionLevelSchema>;
