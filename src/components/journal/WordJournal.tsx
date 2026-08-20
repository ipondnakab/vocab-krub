"use client";

import { useMemo, useState } from "react";
import { useContent, useGame, useGameDispatch } from "../../runtime/GameContext";
import { createI18n, type Bundles } from "../../core/i18n/i18n";
import { isWordMastered, masteryPercent } from "../../core/mastery/mastery";
import { MasteryStars } from "./MasteryStars";
import { ComponentChecklist } from "./ComponentChecklist";
import th from "../../locales/th.json";
import en from "../../locales/en.json";

const bundles = { th, en } as Bundles;

/**
 * T082. The word journal (FR-028, FR-029).
 *
 * Shows mastery per word AND per component, because a single percentage would hide the thing
 * that matters: you know what "go" means but not what it becomes in the past.
 *
 * Note what is NOT here: battle HP. Knowledge and combat are separate systems (FR-029), and
 * mixing them in one screen would suggest otherwise.
 */
export function WordJournal() {
  const screen = useGame((s) => s.screen);
  const mastery = useGame((s) => s.player.mastery);
  const locale = useGame((s) => s.player.locale);
  const dispatch = useGameDispatch();
  const content = useContent();
  const t = useMemo(() => createI18n(bundles, locale).t, [locale]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const known = useMemo(
    () => content.words.filter((w) => mastery[w.id]?.encountered),
    [content.words, mastery],
  );

  if (screen !== "journal") return null;

  const selected = content.words.find((w) => w.id === (selectedId ?? known[0]?.id));

  return (
    <div className="journal">
      <div className="panel journal__panel">
        <div className="journal__head">
          <h2 className="journal__title">{t("journal.title")}</h2>
          <button type="button" className="action" onClick={() => dispatch({ type: "close-journal" })} autoFocus>
            {t("common.close")}
          </button>
        </div>

        {known.length === 0 ? (
          <p className="feedback__why">{t("journal.empty")}</p>
        ) : (
          <div className="journal__body">
            <ul className="journal__list">
              {known.map((word) => {
                const record = mastery[word.id];
                const percent = record ? masteryPercent(record) : 0;
                const done = record ? isWordMastered(record) : false;
                return (
                  <li key={word.id}>
                    <button
                      type="button"
                      className={`journal__entry${selected?.id === word.id ? " journal__entry--active" : ""}`}
                      onClick={() => setSelectedId(word.id)}
                    >
                      {/* The word itself is never translated — it is what is being learned. */}
                      <span className="journal__word">{word.word}</span>
                      <MasteryStars percent={percent} />
                      {done && <span className="journal__badge">{t("journal.mastered")}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>

            {selected && (
              <div className="journal__detail">
                <div className="journal__detailhead">
                  <span className="journal__word journal__word--big">{selected.word}</span>
                  <MasteryStars percent={mastery[selected.id] ? masteryPercent(mastery[selected.id]!) : 0} size={20} />
                </div>
                <p className="feedback__why">{selected.meaning[locale]}</p>
                <span className="label">{t("journal.progress")}</span>
                <ComponentChecklist
                  word={selected}
                  mastery={mastery[selected.id]}
                  locale={locale}
                  labels={{ meaning: t("journal.component.meaning"), context: t("journal.component.context") }}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
