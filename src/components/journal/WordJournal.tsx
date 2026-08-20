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
  const [filter, setFilter] = useState<"all" | "mastered" | "progress" | "new">("all");

  /**
   * T060/T061. Grouped by chapter and filterable by state.
   *
   * A flat list was fine at 31 words and is a scroll at 71. Grouping matches how the player
   * learned them; the filter answers the question players actually ask, which is "what do I
   * still not know?"
   *
   * Deliberately NOT a search box: that needs a text input, and the anti-quiz rule forbids
   * native form controls in the game UI. Filters are built from the same menu buttons the rest
   * of the game uses.
   */
  const groups = useMemo(() => {
    const matches = (wordId: string): boolean => {
      const record = mastery[wordId];
      if (!record?.encountered) return false;
      if (filter === "all") return true;
      const percent = masteryPercent(record);
      if (filter === "mastered") return percent === 1;
      if (filter === "progress") return percent > 0 && percent < 1;
      return percent === 0;
    };
    return content.chapters
      .map((chapter) => ({
        chapter,
        words: chapter.vocabularyIds
          .filter(matches)
          .map((id) => content.word(id)),
      }))
      .filter((group) => group.words.length > 0);
  }, [content, mastery, filter]);

  const known = useMemo(() => groups.flatMap((g) => g.words), [groups]);

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

        <div className="journal__filters">
          {([["all", "journal.filterAll"], ["mastered", "journal.filterMastered"],
             ["progress", "journal.filterInProgress"], ["new", "journal.filterNotStarted"]] as const)
            .map(([value, key]) => (
              <button
                key={value}
                type="button"
                className={`action${filter === value ? " action--primary" : ""}`}
                onClick={() => setFilter(value)}
              >
                {t(key)}
              </button>
            ))}
          <span className="label journal__count">{t("journal.count", { count: known.length })}</span>
        </div>

        {known.length === 0 ? (
          <p className="feedback__why">{t("journal.empty")}</p>
        ) : (
          <div className="journal__body">
            <div className="journal__list">
              {groups.map((group) => (
                <section key={group.chapter.id} className="journal__group">
                  <h3 className="label journal__grouptitle">{group.chapter.title[locale]}</h3>
                  <ul className="journal__grouplist">
                    {group.words.map((word) => {
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
                </section>
              ))}
            </div>

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
