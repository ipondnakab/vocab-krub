"use client";

import { useMemo } from "react";
import { useGame, useGameDispatch } from "../../runtime/GameContext";
import { createI18n, type Bundles } from "../../core/i18n/i18n";
import { HpBar } from "./HpBar";
import { QuestionPanel } from "./QuestionPanel";
import { FeedbackPanel } from "./FeedbackPanel";
import th from "../../locales/th.json";
import en from "../../locales/en.json";

const bundles = { th, en } as Bundles;

/**
 * T051 + T052. The battle UI, composed over the Phaser canvas.
 *
 * It reads state and sends intents. It computes no damage, compares no HP to zero, and decides
 * no outcome — every one of those lives in src/core. If a calculation shows up in this file it
 * is in the wrong layer (Constitution Principle II).
 *
 * INPUT LOCKING (FR-010): options are disabled whenever the phase is not `awaiting-answer`, and
 * the store DROPS any intent that slips through. Belt and braces on purpose — an answer that
 * queues during a death animation and resolves into an ended battle is a real bug, not a
 * hypothetical one.
 */
export function BattleHud() {
  const battle = useGame((s) => s.battle);
  const lastTurn = useGame((s) => s.lastTurn);
  const locale = useGame((s) => s.player.locale);
  const dispatch = useGameDispatch();

  const t = useMemo(() => createI18n(bundles, locale).t, [locale]);

  if (!battle) return null;

  const monsterName = battle.monsterId;
  const awaiting = battle.phase === "awaiting-answer";
  const showingFeedback = battle.phase === "showing-feedback";
  const ended = battle.phase === "ended";

  // After a resolved turn, mark which option was right — including on a correct answer, so the
  // player always sees confirmation rather than the question simply vanishing.
  const resolvedQuestion = showingFeedback ? battle.currentQuestion : null;
  const revealedIndex = showingFeedback ? (resolvedQuestion?.correctIndex ?? null) : null;

  return (
    <div className="battle">
      <div className="battle__top">
        <HpBar label={monsterName} hp={battle.monsterHp} maxHp={battle.monsterMaxHp} variant="monster" />
      </div>

      <div className="battle__stage-gap" />

      <div className="battle__bottom">
        <HpBar label={t("hud.hp")} hp={battle.player.hp} maxHp={battle.player.maxHp} variant="player" />

        <div className="battle__panels">
        {ended ? (
          <BattleOutcome
            outcome={battle.outcome}
            t={t}
            onLeave={() => dispatch({ type: "leave-battle" })}
          />
        ) : showingFeedback && battle.feedback ? (
          <>
            {resolvedQuestion && (
              <QuestionPanel
                question={resolvedQuestion}
                locale={locale}
                disabled
                revealedIndex={revealedIndex}
                chosenIndex={null}
                onChoose={() => {}}
              />
            )}
            <FeedbackPanel
              feedback={battle.feedback}
              locale={locale}
              answerLabel={t("battle.feedbackTitle")}
              dismissLabel={t("battle.feedbackDismiss")}
              onDismiss={() => dispatch({ type: "dismiss-feedback" })}
            />
          </>
        ) : (
          battle.currentQuestion && (
            <>
              <QuestionPanel
                question={battle.currentQuestion}
                locale={locale}
                disabled={!awaiting}
                revealedIndex={null}
                chosenIndex={null}
                onChoose={(optionIndex) => dispatch({ type: "answer-question", optionIndex })}
              />
              <div className="actions">
                {!battle.isBoss && (
                  <button
                    type="button"
                    className="action"
                    disabled={!awaiting}
                    onClick={() => dispatch({ type: "attempt-flee" })}
                  >
                    {t("battle.flee")}
                  </button>
                )}
                {lastTurn?.correct && (
                  <span className="label" style={{ color: "var(--correct)", alignSelf: "center" }}>
                    {t("battle.damageDealt", { amount: lastTurn.damageDealt })}
                  </span>
                )}
              </div>
            </>
          )
        )}
        </div>
      </div>
    </div>
  );
}

/** T054's copy side. The Phaser scene plays the restoration; this says what it means. */
function BattleOutcome({
  outcome, t, onLeave,
}: {
  outcome: "victory" | "defeat" | "fled" | null;
  t: (key: string, params?: Record<string, string | number>) => string;
  onLeave: () => void;
}) {
  const title =
    outcome === "victory" ? t("battle.victory")
    : outcome === "defeat" ? t("battle.defeat")
    : t("battle.fleeSuccess");

  return (
    <div className="panel panel--raised">
      <div className="outcome">
        <p className={`outcome__title outcome__title--${outcome === "victory" ? "victory" : "defeat"}`}>
          {title}
        </p>
        {outcome === "victory" && (
          // The word is restored, not killed. The Silence is the antagonist; the words are
          // its victims (Constitution Principle I).
          <p className="outcome__note">
            {t("battle.victoryNote")}
          </p>
        )}
        <div className="actions">
          <button type="button" className="action action--primary" onClick={onLeave} autoFocus>
            {t("common.continue")}
          </button>
        </div>
      </div>
    </div>
  );
}
