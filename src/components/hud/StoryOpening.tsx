"use client";

import { useMemo, useState } from "react";
import { useGame } from "../../runtime/GameContext";
import { createI18n, type Bundles } from "../../core/i18n/i18n";
import th from "../../locales/th.json";
import en from "../../locales/en.json";

const bundles = { th, en } as Bundles;
const BEATS = ["story.opening1", "story.opening2", "story.opening3", "story.opening4", "story.opening5"];

/**
 * T120. The opening of Chapter 1.
 *
 * Establishes the premise the whole game rests on: the monsters are forgotten words, not
 * villains, and understanding is what frees them (Constitution Principle I). Skippable, because
 * a player on their second run should not have to read it again.
 */
export function StoryOpening() {
  const locale = useGame((s) => s.player.locale);
  const screen = useGame((s) => s.screen);
  const t = useMemo(() => createI18n(bundles, locale).t, [locale]);
  const [beat, setBeat] = useState(0);
  const [done, setDone] = useState(false);

  if (done || screen !== "world") return null;

  const advance = () => (beat + 1 < BEATS.length ? setBeat(beat + 1) : setDone(true));

  return (
    <div className="story">
      <div className="panel panel--raised story__box">
        <p className="story__line">{t(BEATS[beat] as string)}</p>
        <div className="actions">
          <button type="button" className="action action--primary" autoFocus onClick={advance}>
            {t("common.continue")}
          </button>
          <button type="button" className="action" onClick={() => setDone(true)}>
            {t("story.skip")}
          </button>
          <span className="label story__count">
            {beat + 1} / {BEATS.length}
          </span>
        </div>
      </div>
    </div>
  );
}
