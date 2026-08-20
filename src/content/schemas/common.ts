import { z } from "zod";

/**
 * Shared primitives for every content schema.
 *
 * The distinction between `localized()` and `targetText()` is the most important thing in this
 * file. It encodes FR-052 in the type system so the mistake becomes unrepresentable rather than
 * merely discouraged — see research R-009.
 */

/**
 * Instructional text: prompts, explanations, meanings, NPC lines, UI copy.
 * The player reads this in their own language, so it MUST exist in both locales.
 */
export const localized = () =>
  z.strictObject({
    th: z.string().min(1, "Thai text is required and must not be empty"),
    en: z.string().min(1, "English text is required and must not be empty"),
  });

export type Localized = z.infer<ReturnType<typeof localized>>;

/**
 * Target-language text: the English being LEARNED.
 *
 * A word, its inflected forms, answer options, example sentences, grammar patterns. This is the
 * material under test, so it is never translated — a Thai player answering "what is the past
 * tense of go?" must see `went`, not a Thai gloss.
 *
 * Deliberately a plain string. Putting a `{ th, en }` object here fails validation, which is how
 * FR-052 is enforced structurally rather than by review vigilance.
 */
export const targetText = () => z.string().min(1, "target-language text must not be empty");

export const cefrLevel = () => z.enum(["A1", "A2", "B1", "B2", "C1", "C2"]);
export type CefrLevel = z.infer<ReturnType<typeof cefrLevel>>;

/** Determines damage (research R-006). Deliberately independent of a question's level. */
export const difficultyTier = () => z.enum(["easy", "medium", "hard", "expert"]);
export type DifficultyTier = z.infer<ReturnType<typeof difficultyTier>>;

export const direction = () => z.enum(["up", "down", "left", "right"]);
export type Direction = z.infer<ReturnType<typeof direction>>;

/** kebab-case identifier. Content ids are referenced across files, so shape is enforced. */
export const identifier = () =>
  z
    .string()
    .min(1)
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "must be kebab-case (lowercase letters, digits, hyphens)");

/**
 * A mastery component id: `meaning`, `context`, or `form:<formId>`.
 * Never authored directly — derived from a word's forms. See deriveComponents.
 */
export const componentId = () =>
  z.string().regex(/^(meaning|context|form:[a-z0-9]+(-[a-z0-9]+)*)$/, "invalid mastery component id");
