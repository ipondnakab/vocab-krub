"use client";

import type { WordMastery } from "../../core/player/playerState";
import type { Localized, VocabularyWord } from "../../content/schemas";
import type { Locale } from "../../core/i18n/i18n";

/**
 * T081. Which parts of a word the player actually knows (FR-028).
 *
 * Per-component, never a single aggregate number. Constitution Principle IV: mastery is earned
 * component by component, so it has to be SHOWN component by component — a lone percentage would
 * hide that you know what "go" means but not what it becomes in the past.
 */
export function ComponentChecklist({
  word, mastery, locale, labels,
}: {
  word: VocabularyWord;
  mastery: WordMastery | undefined;
  locale: Locale;
  labels: { meaning: string; context: string };
}) {
  const rows: Array<{ id: string; label: string; detail: string | null }> = [
    { id: "meaning", label: labels.meaning, detail: word.meaning[locale] },
    ...word.forms.map((form) => ({
      id: `form:${form.id}`,
      label: labelOf(form.roleLabel, locale),
      // The form itself is target-language text and is never translated (FR-052).
      detail: form.text,
    })),
    { id: "context", label: labels.context, detail: null },
  ];

  return (
    <ul className="checklist">
      {rows.map((row) => {
        const done = mastery?.components[row.id]?.mastered ?? false;
        return (
          <li key={row.id} className={`checklist__item${done ? " checklist__item--done" : ""}`}>
            <span className="checklist__mark">{done ? "✓" : "○"}</span>
            <span className="checklist__label">{row.label}</span>
            {row.detail && <span className="checklist__detail">{row.detail}</span>}
          </li>
        );
      })}
    </ul>
  );
}

function labelOf(field: Localized, locale: Locale): string {
  return field[locale];
}
