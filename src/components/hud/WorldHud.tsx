"use client";

import { useEffect, useMemo } from "react";
import { useGame, useGameDispatch } from "../../runtime/GameContext";
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
  const dispatch = useGameDispatch();
  const t = useMemo(() => createI18n(bundles, player.locale).t, [player.locale]);

  /*
   * The M key lives HERE, not beside the minimap.
   *
   * The minimap unmounts when it is closed, so a listener inside it could never reopen it — the
   * key would work exactly once. WorldHud stays mounted for the whole of exploration, which also
   * gives FR-021 for free: M is inert on every other screen because this component is not there.
   */
  useEffect(() => {
    if (screen !== "world") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.code === "KeyM") {
        event.preventDefault();
        dispatch({ type: "toggle-minimap" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [screen, dispatch]);

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
        {/* Hints stack rather than sharing a row: side by side in an 18rem panel they wrapped
            mid-phrase ("กด E เพื่อ / พูดคุย"), which is worse than no hint at all. */}
        <div className="worldhud__hints">
          <span className="label">{t("world.interactHint")}</span>
          {/* Hidden by default means a player who never presses M never learns it exists (FR-022). */}
          <span className="label">{t("world.minimapHint")}</span>
        </div>
        <div className="worldhud__row">
          {/*
            T078. The switch changes INSTRUCTION only — the English being learned never moves.
            A Thai player and an English player see the same answer options, because those
            options are the material under test (FR-052).
          */}
          <button type="button" className="action worldhud__locale"
                  onClick={() => dispatch({ type: "open-journal" })}>
            {t("hud.journal")}
          </button>
          <button
            type="button"
            className="action worldhud__locale"
            onClick={() => dispatch({ type: "set-locale", locale: player.locale === "th" ? "en" : "th" })}
          >
            {player.locale === "th" ? t("common.localeEndonymEn") : t("common.localeEndonymTh")}
          </button>
        </div>
      </div>
    </div>
  );
}
