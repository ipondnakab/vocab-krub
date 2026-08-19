import { z } from "zod";
import { identifier, localized } from "./common.js";
import { rewardTableSchema } from "./monsters.js";

export const challengeConfigSchema = z.strictObject({
  questionCount: z.number().int().positive(),
  /** Fraction of questions that must be correct to pass (FR-047). */
  passThreshold: z.number().min(0).max(1),
  guardNpcId: identifier(),
});

export const chapterSchema = z.strictObject({
  id: identifier(),
  title: localized(),
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
