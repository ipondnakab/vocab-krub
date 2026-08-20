"use client";

import type { Feedback } from "../../core/battle/battle";
import type { Locale } from "../../core/i18n/i18n";

/**
 * T050. What a wrong answer teaches (FR-004).
 *
 * This is a Constitution Principle IV requirement, not a nicety: every incorrect response must
 * show what the correct answer was and why, and the monster's counterattack does not resolve
 * until the player dismisses this. The ordering is enforced by the battle state machine — the
 * store will not accept anything but `dismiss-feedback` while this is up.
 */
export function FeedbackPanel({
  feedback, locale, answerLabel, dismissLabel, onDismiss,
}: {
  feedback: Feedback;
  locale: Locale;
  answerLabel: string;
  dismissLabel: string;
  onDismiss: () => void;
}) {
  return (
    <div className="panel panel--raised">
      <div className="feedback">
        <span className="label">{answerLabel}</span>
        <p className="feedback__answer">{feedback.correctOption}</p>
        <p className="feedback__why">{feedback.explanation[locale]}</p>
        <div className="actions">
          <button type="button" className="action action--primary" onClick={onDismiss} autoFocus>
            {dismissLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
