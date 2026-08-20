"use client";

import { useMemo } from "react";
import { useContent, useGame, useGameDispatch } from "../../runtime/GameContext";
import { createI18n, type Bundles } from "../../core/i18n/i18n";
import { currentChallengeQuestion } from "../../core/chapter/challenge";
import { OptionList } from "../battle/OptionList";
import th from "../../locales/th.json";
import en from "../../locales/en.json";

const bundles = { th, en } as Bundles;

/**
 * T105 + T106. The castle gate.
 *
 * Framed as a guard blocking your way, in his portrait and his voice — a story moment, not an
 * exam screen (Constitution Principle I). The player's HP bar is deliberately absent: the
 * challenge cannot hurt you, and showing a health bar would imply otherwise.
 */
export function ChallengePanel() {
  const challenge = useGame((s) => s.challenge);
  const result = useGame((s) => s.challengeResult);
  const locale = useGame((s) => s.player.locale);
  const content = useContent();
  const dispatch = useGameDispatch();
  const t = useMemo(() => createI18n(bundles, locale).t, [locale]);

  if (!challenge) return null;

  const chapter = content.chapter(challenge.chapterId);
  const guard = content.npc(chapter.challenge.guardNpcId);
  const question = currentChallengeQuestion(challenge);
  const correctCount = challenge.answers.filter((a) => a.correct).length;

  const topicName = (key: string): string =>
    key.startsWith("word:")
      ? content.word(key.slice("word:".length)).word
      : content.grammarTopic(key).name[locale];

  return (
    <div className="dialogue">
      <div className="panel dialogue__box">
        <div className="dialogue__head">
          <div className="dialogue__portrait" data-pixel>
            <img src={`/assets/placeholder/portraits/${guard.portrait}.png`} alt="" width={64} height={64} />
          </div>
          <span className="dialogue__name">{guard.name[locale]}</span>
          {!result && (
            <span className="label challenge__progress">
              {t("challenge.progress", { current: challenge.index + 1, total: challenge.questions.length })}
            </span>
          )}
        </div>

        {result ? (
          <div className="outcome">
            <p className={`outcome__title outcome__title--${result.passed ? "victory" : "defeat"}`}>
              {result.passed ? t("challenge.passed") : t("challenge.failed")}
            </p>
            <p className="outcome__note">
              {result.passed ? t("challenge.passedNote") : t("challenge.failedNote")}
            </p>
            <p className="label">
              {t("challenge.score", { correct: correctCount, total: challenge.questions.length })}
            </p>
            {!result.passed && result.weakestTopics.length > 0 && (
              // A failure that does not say what to study is just a wall.
              <p className="feedback__why">
                {t("challenge.weakest", { topics: result.weakestTopics.map(topicName).join(", ") })}
              </p>
            )}
            <div className="actions">
              <button type="button" className="action action--primary" autoFocus
                      onClick={() => dispatch({ type: "close-challenge" })}>
                {t("common.close")}
              </button>
            </div>
          </div>
        ) : challenge.feedback ? (
          <>
            <p className={`dialogue__verdict dialogue__verdict--${challenge.feedback.correct ? "right" : "wrong"}`}>
              {challenge.feedback.correct
                ? t("dialogue.praise")
                : t("dialogue.correction", { answer: challenge.feedback.correctOption })}
            </p>
            <p className="feedback__why">{challenge.feedback.explanation[locale]}</p>
            <div className="actions">
              <button type="button" className="action action--primary" autoFocus
                      onClick={() => dispatch({ type: "advance-challenge" })}>
                {t("common.continue")}
              </button>
            </div>
          </>
        ) : question ? (
          <>
            <p className="prompt">{question.prompt[locale]}</p>
            <OptionList
              options={question.options}
              disabled={false}
              revealedIndex={null}
              chosenIndex={null}
              onChoose={(optionIndex) => dispatch({ type: "answer-challenge", optionIndex })}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}
