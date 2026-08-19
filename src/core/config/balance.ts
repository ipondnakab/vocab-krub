import { balanceConfigSchema, type BalanceConfig, type DifficultyTier } from "../../content/schemas/index.js";
import { ContentValidationError, formatPath, type ContentIssue } from "../content/errors.js";

/**
 * Typed access to the balance configuration (Constitution Principle III).
 *
 * Every tunable number in the game resolves through here. If a gameplay module needs a number
 * and it is not a structural constant, it belongs in balance.json — not at the call site.
 */
export function parseBalance(raw: unknown): BalanceConfig {
  const result = balanceConfigSchema.safeParse(raw);
  if (result.success) return result.data;
  const issues: ContentIssue[] = result.error.issues.map((issue) => ({
    file: "balance.json",
    path: formatPath(issue.path),
    message: issue.message,
  }));
  throw new ContentValidationError(issues);
}

export function baseDamageFor(tier: DifficultyTier, balance: BalanceConfig): number {
  return balance.damage.byDifficulty[tier];
}

/** Level for a cumulative XP total. Level 1 is the floor; the curve is authored, not computed. */
export function levelForXp(xp: number, balance: BalanceConfig): number {
  const curve = balance.player.xpCurve;
  let level = 1;
  for (let i = 1; i < curve.length; i += 1) {
    const threshold = curve[i];
    if (threshold === undefined || xp < threshold) break;
    level = i + 1;
  }
  return level;
}

export function maxHpForLevel(level: number, balance: BalanceConfig): number {
  return balance.player.baseMaxHp + balance.player.hpPerLevel * (level - 1);
}
