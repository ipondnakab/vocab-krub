"use client";

import { useEffect } from "react";

const KEYS = ["A", "B", "C", "D"] as const;

/**
 * T049. The four answers.
 *
 * Keyboard-first, because a JRPG menu is keyboard-first: A-D or 1-4 select directly. Rendered
 * from the SHUFFLED options in PresentedQuestion, so the authored ordering never reaches here
 * (every authored question has correctIndex 0 — a leak would make the answer always first).
 */
export function OptionList({
  options, disabled, revealedIndex, chosenIndex, eliminated = [], onChoose,
}: {
  options: readonly string[];
  disabled: boolean;
  /** Set after an answer resolves, to mark which option was right. */
  revealedIndex: number | null;
  chosenIndex: number | null;
  eliminated?: readonly number[];
  onChoose: (index: number) => void;
}) {
  useEffect(() => {
    if (disabled) return;
    const onKey = (event: KeyboardEvent) => {
      const letter = KEYS.indexOf(event.key.toUpperCase() as (typeof KEYS)[number]);
      const digit = Number.parseInt(event.key, 10) - 1;
      const index = letter >= 0 ? letter : Number.isNaN(digit) ? -1 : digit;
      if (index >= 0 && index < options.length && !eliminated.includes(index)) {
        event.preventDefault();
        onChoose(index);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [disabled, options.length, eliminated, onChoose]);

  return (
    <div className="options">
      {options.map((option, index) => {
        const isCorrect = revealedIndex === index;
        const isWrongChoice = chosenIndex === index && revealedIndex !== index;
        const isEliminated = eliminated.includes(index);
        return (
          <button
            key={option}
            type="button"
            className={[
              "option",
              isCorrect ? "option--correct" : "",
              isWrongChoice ? "option--wrong" : "",
              isEliminated ? "option--eliminated" : "",
            ].filter(Boolean).join(" ")}
            disabled={disabled || isEliminated}
            onClick={() => onChoose(index)}
          >
            <span className="option__key">{KEYS[index] ?? index + 1}</span>
            <span>{option}</span>
          </button>
        );
      })}
    </div>
  );
}
