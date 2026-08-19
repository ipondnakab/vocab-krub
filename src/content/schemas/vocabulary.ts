import { z } from "zod";
import { cefrLevel, identifier, localized, targetText } from "./common.js";

/** One inflected member of a word family: for GO — go, went, gone, going. */
export const wordFormSchema = z.strictObject({
  id: identifier(),
  /** The inflected form itself. Target language — never translated. */
  text: targetText(),
  role: z.enum([
    "base",
    "past",
    "past-participle",
    "present-participle",
    "third-person",
    "plural",
    "comparative",
    "superlative",
  ]),
  /** How the role is named TO the player, so this one is localized. */
  roleLabel: localized(),
});

export const exampleSchema = z.strictObject({
  /** English sentence using the word. Target language — never translated. */
  sentence: targetText(),
  /** The help text shown beside it. */
  translation: localized(),
  /** Which form this sentence demonstrates. Must exist on the word (cross-file validation). */
  formId: identifier(),
});

export const vocabularyWordSchema = z.strictObject({
  id: identifier(),
  /** The English base form. Target language — never translated. */
  word: targetText(),
  meaning: localized(),
  cefr: cefrLevel(),
  topic: identifier(),
  difficulty: z.number().int().min(1).max(5),
  forms: z.array(wordFormSchema).min(1, "a word must declare at least one form"),
  examples: z.array(exampleSchema).min(1, "a word must have at least one example"),
});

export const vocabularySchema = z.strictObject({
  words: z.array(vocabularyWordSchema),
});

export type WordForm = z.infer<typeof wordFormSchema>;
export type Example = z.infer<typeof exampleSchema>;
export type VocabularyWord = z.infer<typeof vocabularyWordSchema>;
