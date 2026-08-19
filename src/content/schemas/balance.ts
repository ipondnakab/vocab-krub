import { z } from "zod";

/**
 * Every tunable number in the game (Constitution Principle III).
 *
 * A literal in gameplay code is a defect unless it is a structural constant. If you find
 * yourself typing a number into src/core, it probably belongs here.
 */
export const balanceConfigSchema = z.strictObject({
  damage: z.strictObject({
    byDifficulty: z.strictObject({
      easy: z.number().int().positive(),
      medium: z.number().int().positive(),
      hard: z.number().int().positive(),
      expert: z.number().int().positive(),
    }),
  }),
  player: z.strictObject({
    baseMaxHp: z.number().int().positive(),
    hpPerLevel: z.number().int().nonnegative(),
    /** Cumulative XP required to reach each level. Index 0 is level 1. */
    xpCurve: z.array(z.number().int().nonnegative()).min(2),
  }),
  mastery: z.strictObject({
    /** Consecutive correct answers to master a component. >1 by design — FR-024. */
    streakRequired: z.number().int().min(2),
  }),
  questions: z.strictObject({
    /**
     * Target share of each battle's questions drawn from previously learned words.
     * Honoured by normalising the two pools against each other, so this is the ONLY knob
     * controlling the ratio — a separate monster-word weight would silently fight it.
     */
    reviewProportion: z.number().min(0).max(1),
    weightUnmasteredComponent: z.number().positive(),
    weightMasteredComponent: z.number().positive(),
    recencyPenalty: z.number().min(0).max(1),
  }),
  battle: z.strictObject({
    fleeSuccessChance: z.number().min(0).max(1),
    /** Fraction of carried gold lost on defeat. Never touches mastery (FR-014). */
    defeatGoldPenalty: z.number().min(0).max(1),
  }),
  challenge: z.strictObject({
    defaultPassThreshold: z.number().min(0).max(1),
  }),
});

export type BalanceConfig = z.infer<typeof balanceConfigSchema>;
