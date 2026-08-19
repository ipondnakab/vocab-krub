import type { BalanceConfig, Item } from "../../content/schemas/index";
import { baseDamageFor } from "../config/balance";
import type { PresentedQuestion } from "./present";

/**
 * Damage from a correct answer (FR-005, research R-006).
 *
 *   damage = balance.damage.byDifficulty[tier] * weapon damage multiplier
 *
 * Driven by the question's DIFFICULTY TIER, never its level. A level-1 meaning question about a
 * rare word can be harder than a level-3 form question about `go`; binding damage to level would
 * force authors to misclassify a question's type to get the damage they want.
 *
 * Note what is absent: the player's level. Grinding must not make fights trivial — knowledge is
 * the weapon, not accumulated stats.
 */
export function damageFor(
  question: Pick<PresentedQuestion, "difficulty">,
  weapon: Item | null,
  balance: BalanceConfig,
): number {
  const base = baseDamageFor(question.difficulty, balance);
  return Math.max(0, Math.round(base * weaponMultiplier(weapon)));
}

export function weaponMultiplier(weapon: Item | null): number {
  if (!weapon) return 1;
  let multiplier = 1;
  for (const effect of weapon.effects) {
    if (effect.kind === "damage-multiplier") multiplier *= effect.value;
  }
  return multiplier;
}

/**
 * Damage the monster deals on a miss (FR-006). Armor reduces it; the result floors at zero, so
 * armor can never heal the player.
 */
export function incomingDamage(monsterAttack: number, armor: Item | null): number {
  let reduction = 0;
  if (armor) {
    for (const effect of armor.effects) {
      if (effect.kind === "damage-reduction") reduction += effect.value;
    }
  }
  return Math.max(0, Math.round(monsterAttack - reduction));
}
