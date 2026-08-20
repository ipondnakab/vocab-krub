"use client";

import { useMemo } from "react";
import { useGame } from "../../runtime/GameContext";
import { createI18n, type Bundles } from "../../core/i18n/i18n";
import { HpBar } from "../battle/HpBar";
import th from "../../locales/th.json";
import en from "../../locales/en.json";

const bundles = { th, en } as Bundles;

/**
 * T065. The exploration HUD.
 *
 * Deliberately sparse: while exploring, the player should be looking at the world, not at a
 * dashboard. Level, HP, and gold — nothing that turns walking around into a stats screen
 * (Constitution Principle I).
 */
export function WorldHud() {
  const player = useGame((s) => s.player);
  const screen = useGame((s) => s.screen);
  const t = useMemo(() => createI18n(bundles, player.locale).t, [player.locale]);

  if (screen !== "world") return null;

  return (
    <div className="worldhud">
      <div className="panel worldhud__panel">
        <div className="worldhud__stats">
          <span className="label">
            {t("hud.level")} {player.level}
          </span>
          <span className="label">
            {t("hud.gold")} {player.gold}
          </span>
        </div>
        <HpBar label={t("hud.hp")} hp={player.hp} maxHp={player.maxHp} variant="player" />
      </div>
    </div>
  );
}
