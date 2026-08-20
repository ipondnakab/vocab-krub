import { z } from "zod";
import { identifier, localized } from "./common";
import { rewardTableSchema } from "./monsters";

export const challengeConfigSchema = z.strictObject({
  questionCount: z.number().int().positive(),
  /** Fraction of questions that must be correct to pass (FR-047). */
  passThreshold: z.number().min(0).max(1),
  guardNpcId: identifier(),
});

export const chapterSchema = z.strictObject({
  id: identifier(),
  title: localized(),
  /**
   * The chapter that must be completed before this one opens. `null` marks the campaign entry
   * point, and exactly one chapter may have it.
   *
   * Ordering lives in content rather than code (research R-103): reordering the campaign or
   * inserting a side chapter should not need an engineer.
   */
  requiresChapterId: identifier().nullable(),
  mapIds: z.array(identifier()).min(1),
  vocabularyIds: z.array(identifier()),
  grammarTopicIds: z.array(identifier()),
  monsterIds: z.array(identifier()),
  npcIds: z.array(identifier()),
  bossMonsterId: identifier(),
  challenge: challengeConfigSchema,
  completionReward: rewardTableSchema,
});

export const chaptersSchema = z.strictObject({ chapters: z.array(chapterSchema) });

export type ChallengeConfig = z.infer<typeof challengeConfigSchema>;
export type Chapter = z.infer<typeof chapterSchema>;
