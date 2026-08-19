"use client";

import type { Locale } from "../../core/i18n/i18n";
import type { PresentedQuestion } from "../../core/questions/present";
import { OptionList } from "./OptionList";

/**
 * T049. The prompt and its options.
 *
 * The prompt is localized (Thai or English instruction); the options never are — they are the
 * English under test (FR-052). This component is the reason the stack moved to React: Thai
 * combining vowels and tone marks lay out correctly in the DOM and unreliably in canvas text.
 */
export function QuestionPanel({
  question, locale, disabled, revealedIndex, chosenIndex, onChoose,
}: {
  question: PresentedQuestion;
  locale: Locale;
  disabled: boolean;
  revealedIndex: number | null;
  chosenIndex: number | null;
  onChoose: (index: number) => void;
}) {
  return (
    <div className="panel">
      <p className="prompt">{question.prompt[locale]}</p>
      <OptionList
        options={question.options}
        disabled={disabled}
        revealedIndex={revealedIndex}
        chosenIndex={chosenIndex}
        onChoose={onChoose}
      />
    </div>
  );
}
