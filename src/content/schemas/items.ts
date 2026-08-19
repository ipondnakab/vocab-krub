import { z } from "zod";
import { identifier, localized } from "./common.js";

/**
 * The effect union is CLOSED, and that is a pedagogical guarantee, not a typing convenience.
 *
 * Constitution Principle IV and FR-043: no item, weapon, armor, or pet may select, submit, or
 * skip an answer. Because every effect a designer can author must be one of these variants, that
 * promise is checkable — T093 enumerates this union and asserts none of them can answer a
 * question. Adding a variant is a spec change, and that test is what makes it one.
 */
export const effectSchema = z.discriminatedUnion("kind", [
  /** Scales player attack damage on a correct answer. */
  z.strictObject({ kind: z.literal("damage-multiplier"), value: z.number().positive() }),
  /** Flat reduction of incoming damage, floored at 0 (FR-006). */
  z.strictObject({ kind: z.literal("damage-reduction"), value: z.number().nonnegative() }),
  /** First miss of the scoped kind per battle deals no damage. */
  z.strictObject({ kind: z.literal("first-mistake-free"), scope: identifier() }),
  /** Removes ONE incorrect option. Never reveals the answer (FR-042). */
  z.strictObject({ kind: z.literal("reveal-wrong-option"), usesPerBattle: z.number().int().positive() }),
  /** Multiplies XP earned. */
  z.strictObject({ kind: z.literal("xp-bonus"), value: z.number().positive() }),
]);

export const unlockSchema = z.discriminatedUnion("type", [
  z.strictObject({ type: z.literal("words-mastered"), threshold: z.number().int().positive() }),
  z.strictObject({ type: z.literal("chapter-complete"), chapterId: identifier() }),
  z.strictObject({ type: z.literal("monster-drop") }),
]);

export const itemSchema = z.strictObject({
  id: identifier(),
  name: localized(),
  description: localized(),
  kind: z.enum(["weapon", "armor", "consumable", "pet"]),
  effects: z.array(effectSchema),
  unlock: unlockSchema.nullable(),
});

export const itemsSchema = z.strictObject({ items: z.array(itemSchema) });
export const petsSchema = z.strictObject({ pets: z.array(itemSchema) });

export type Effect = z.infer<typeof effectSchema>;
export type EffectKind = Effect["kind"];
export type Unlock = z.infer<typeof unlockSchema>;
export type Item = z.infer<typeof itemSchema>;
