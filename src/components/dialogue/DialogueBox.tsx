"use client";

import { useEffect, useMemo } from "react";
import { useContent, useGame, useGameDispatch } from "../../runtime/GameContext";
import { createI18n, type Bundles } from "../../core/i18n/i18n";
import { OptionList } from "../battle/OptionList";
import th from "../../locales/th.json";
import en from "../../locales/en.json";

const bundles = { th, en } as Bundles;

/**
 * T071 + T074 + T075. NPC conversation, including grammar lessons.
 *
 * Constitution Principle I: practice questions render INSIDE this frame, in the NPC's voice,
 * with their portrait still showing. There is no separate quiz screen, because the moment a
 * lesson becomes a test screen the game stops being a game.
 *
 * There is also no HP bar here, and no way to reach one — an NPC correcting your grammar is a
 * conversation, not a fight (FR-038).
 */
export function DialogueBox() {
  const dialogue = useGame((s) => s.dialogue);
  const locale = useGame((s) => s.player.locale);
  const content = useContent();
  const dispatch = useGameDispatch();
  const t = useMemo(() => createI18n(bundles, locale).t, [locale]);

  const advancing = dialogue !== null && dialogue.phase !== "practice";

  useEffect(() => {
    if (!advancing) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " " || event.key === "e" || event.key === "E") {
        event.preventDefault();
        dispatch(dialogue?.phase === "ended" ? { type: "close-dialogue" } : { type: "advance-dialogue" });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [advancing, dialogue?.phase, dispatch]);

  if (!dialogue) return null;

  const npc = content.npc(dialogue.npcId);
  const node = content.dialogueNode(dialogue.nodeId);
  const line = node.lines[dialogue.lineIndex] ?? node.lines[0]!;
  const practice = dialogue.currentPractice;
  const feedback = dialogue.feedback;

  return (
    <div className="dialogue">
      <div className="panel dialogue__box">
        <div className="dialogue__head">
          {/* Placeholder portraits are flat colour; real art drops in at the same path. */}
          <div className="dialogue__portrait" data-pixel>
            <img src={`/assets/placeholder/portraits/${npc.portrait}.png`} alt="" width={64} height={64} />
          </div>
          <span className="dialogue__name">{npc.name[locale]}</span>
        </div>

        {dialogue.phase === "practice" && practice ? (
          <>
            <p className="prompt">{practice.prompt[locale]}</p>
            <OptionList
              options={practice.options}
              disabled={false}
              revealedIndex={null}
              chosenIndex={null}
              onChoose={(optionIndex) => dispatch({ type: "answer-practice", optionIndex })}
            />
          </>
        ) : dialogue.phase === "practice-feedback" && feedback ? (
          <>
            <p className={`dialogue__verdict dialogue__verdict--${feedback.correct ? "right" : "wrong"}`}>
              {feedback.correct ? t("dialogue.praise") : t("dialogue.correction", { answer: feedback.correctOption })}
            </p>
            <p className="feedback__why">{feedback.explanation[locale]}</p>
            <div className="actions">
              <button type="button" className="action action--primary" autoFocus
                      onClick={() => dispatch({ type: "advance-dialogue" })}>
                {t("common.continue")}
              </button>
            </div>
          </>
        ) : dialogue.phase === "ended" ? (
          <>
            <p className="prompt">{line[locale]}</p>
            <div className="actions">
              <button type="button" className="action action--primary" autoFocus
                      onClick={() => dispatch({ type: "close-dialogue" })}>
                {t("common.close")}
              </button>
              {npc.grammarTopicId && (
                <button type="button" className="action" onClick={() => dispatch({ type: "replay-lesson" })}>
                  {t("dialogue.replayLesson")}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
            <p className="prompt">{line[locale]}</p>
            <div className="actions">
              <button type="button" className="action action--primary" autoFocus
                      onClick={() => dispatch({ type: "advance-dialogue" })}>
                {t("common.continue")}
              </button>
              <span className="label dialogue__hint">{t("dialogue.advanceHint")}</span>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
