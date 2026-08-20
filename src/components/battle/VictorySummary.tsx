"use client";

import { useMemo } from "react";
import { useContent, useGame } from "../../runtime/GameContext";
import { createI18n, type Bundles } from "../../core/i18n/i18n";
import { wordsMasteredCount } from "../../core/mastery/mastery";
import th from "../../locales/th.json";
import en from "../../locales/en.json";

const bundles = { th, en } as Bundles;

/**
 * T098. What the victory paid out (FR-039, FR-044).
 *
 * The unlock line names the LEARNING that earned it — "for mastering 3 words" — rather than just
 * announcing an item. Constitution Principle IV: equipment is a reward for understanding, and
 * the player should be able to see the connection.
 */
export function VictorySummary() {
  const rewards = useGame((s) => s.lastRewards);
  const player = useGame((s) => s.player);
  const locale = useGame((s) => s.player.locale);
  const content = useContent();
  const t = useMemo(() => createI18n(bundles, locale).t, [locale]);

  if (!rewards) return null;

  const lines: string[] = [];
  if (rewards.xpGained > 0) lines.push(t("victory.xp", { amount: rewards.xpGained }));
  if (rewards.goldGained > 0) lines.push(t("victory.gold", { amount: rewards.goldGained }));
  for (const itemId of rewards.itemsGained) {
    lines.push(t("victory.item", { name: content.item(itemId).name[locale] }));
  }
  if (rewards.leveledUp) lines.push(t("victory.levelUp", { level: player.level }));

  return (
    <div className="summary">
      <span className="label">{t("victory.title")}</span>
      <ul className="summary__list">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
        {rewards.equipmentUnlocked.map((itemId) => (
          <li key={itemId} className="summary__unlock">
            {t("victory.unlock", {
              name: content.item(itemId).name[locale],
              count: wordsMasteredCount(player),
            })}
          </li>
        ))}
      </ul>
    </div>
  );
}
