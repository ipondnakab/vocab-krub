"use client";

import { useMemo } from "react";
import { useContent, useGame } from "../../runtime/GameContext";
import { createI18n, type Bundles } from "../../core/i18n/i18n";
import { MasteryStars } from "../journal/MasteryStars";
import th from "../../locales/th.json";
import en from "../../locales/en.json";

const bundles = { th, en } as Bundles;

/**
 * T084. The moment a word reaches 100%.
 *
 * Five stars and a line saying the word is itself again — RESTORED, not defeated. Constitution
 * Principle I: the monsters are forgotten words, not villains, so the biggest celebration in the
 * game must read as something coming home rather than something being beaten.
 *
 * Driven by `wordMasteredNow` on the last turn's mastery events, so it fires exactly once, on
 * the answer that completed the final component.
 */
export function MasteryMoment() {
  const lastTurn = useGame((s) => s.lastTurn);
  const locale = useGame((s) => s.player.locale);
  const content = useContent();
  const t = useMemo(() => createI18n(bundles, locale).t, [locale]);

  const event = lastTurn?.masteryEvents.find((e) => e.wordMasteredNow);
  if (!event) return null;

  return (
    <div className="moment">
      <div className="panel panel--raised moment__box">
        <MasteryStars percent={1} size={22} />
        <p className="moment__title">{t("mastery.wordMastered", { word: content.word(event.wordId).word })}</p>
        <p className="moment__note">{t("mastery.restored")}</p>
      </div>
    </div>
  );
}
