import { z } from "zod";
import { identifier, localized } from "./common";

export const dropSchema = z.strictObject({
  itemId: identifier(),
  /** Resolved by the seeded Rng (R-007), so drops are reproducible in tests. */
  chance: z.number().min(0).max(1),
});

export const rewardTableSchema = z.strictObject({
  xp: z.number().int().nonnegative(),
  gold: z.number().int().nonnegative(),
  drops: z.array(dropSchema),
});

export const monsterSchema = z.strictObject({
  id: identifier(),
  /** The word this monster embodies. A corrupted word, not a villain (Principle I). */
  wordId: identifier(),
  name: localized(),
  maxHp: z.number().int().positive(),
  /** Damage dealt on a player miss, before armor reduction. */
  attack: z.number().int().nonnegative(),
  /** Bosses disallow flee (FR-012). */
  isBoss: z.boolean(),
  questionPoolIds: z.array(identifier()).min(1, "a monster must have at least one question"),
  rewards: rewardTableSchema,
  sprite: z.strictObject({
    key: identifier(),
    /** Frame 3 is `restored`, not dead — see contracts/asset-contract.md § 3. */
    frames: z.number().int().positive(),
  }),
});

export const monstersSchema = z.strictObject({ monsters: z.array(monsterSchema) });

export type Drop = z.infer<typeof dropSchema>;
export type RewardTable = z.infer<typeof rewardTableSchema>;
export type Monster = z.infer<typeof monsterSchema>;
