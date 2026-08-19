import { z } from "zod";
import { cefrLevel, identifier, localized, targetText } from "./common";

export const grammarTopicSchema = z.strictObject({
  id: identifier(),
  name: localized(),
  /** Ordered lesson pages, delivered inside NPC dialogue (FR-035). */
  explanation: z.array(localized()).min(1, "a grammar topic must have at least one lesson page"),
  /** Example patterns such as `I + verb`. Target language — never translated. */
  patterns: z.array(targetText()),
  cefr: cefrLevel(),
});

export const grammarSchema = z.strictObject({
  topics: z.array(grammarTopicSchema),
});

export type GrammarTopic = z.infer<typeof grammarTopicSchema>;
