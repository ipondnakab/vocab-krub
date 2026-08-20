import type { BalanceConfig, DialogueNode, Localized } from "../../content/schemas";
import type { ContentIndex } from "../content/loadContent";
import { initMastery, isWordMastered, recordAnswer } from "../mastery/mastery";
import type { PlayerState } from "../player/playerState";
import { correctOptionText, gradeAnswer, presentQuestion, type PresentedQuestion } from "../questions/present";
import type { Rng } from "../rng/rng";
import type { MasteryEvent } from "../battle/battle";
import { isGrammarLearned, learnGrammar } from "../progression/grammar";

/**
 * NPC conversation and grammar lessons (FR-034 … FR-038).
 *
 * Constitution Principle I: grammar is taught by CHARACTERS, in their own voice, inside the
 * dialogue frame. There is no quiz screen here and no HP — an NPC correcting your grammar is a
 * conversation, not a fight, and FR-038 makes that structural: this module has no access to the
 * player's HP at all, so a lesson cannot cost any.
 */

export type DialoguePhase = "lines" | "practice" | "practice-feedback" | "ended";

export interface PracticeFeedback {
  correct: boolean;
  correctOption: string;
  explanation: Localized;
}

export interface DialogueState {
  npcId: string;
  nodeId: string;
  /** Which page of the current node's lines is showing. */
  lineIndex: number;
  phase: DialoguePhase;
  practiceIndex: number;
  currentPractice: PresentedQuestion | null;
  feedback: PracticeFeedback | null;
  /** Recorded on completion (FR-036). Null when this conversation teaches nothing. */
  teachesGrammarId: string | null;
  masteryEvents: MasteryEvent[];
}

export interface DialogueDeps {
  content: ContentIndex;
  balance: BalanceConfig;
  rng: Rng;
}

function node(state: DialogueState, deps: DialogueDeps): DialogueNode {
  return deps.content.dialogueNode(state.nodeId);
}

function enterNode(npcId: string, nodeId: string, deps: DialogueDeps, carry: MasteryEvent[]): DialogueState {
  const current = deps.content.dialogueNode(nodeId);
  return {
    npcId,
    nodeId,
    lineIndex: 0,
    phase: "lines",
    practiceIndex: 0,
    currentPractice: null,
    feedback: null,
    teachesGrammarId: current.teachesGrammarId,
    masteryEvents: carry,
  };
}

/**
 * Opens a conversation.
 *
 * FR-037: an NPC whose lesson you already finished says something different. Anything else makes
 * them feel like a vending machine rather than a person.
 */
export function startDialogue(input: {
  npcId: string;
  player: PlayerState;
  content: ContentIndex;
  balance: BalanceConfig;
  rng: Rng;
  /** Force the first-meeting dialogue, for replaying a lesson on request (FR-036). */
  replayLesson?: boolean;
}): DialogueState {
  const deps: DialogueDeps = { content: input.content, balance: input.balance, rng: input.rng };
  const npc = input.content.npc(input.npcId);
  const lessonDone = npc.grammarTopicId !== null && isGrammarLearned(input.player, npc.grammarTopicId);

  const nodeId = lessonDone && !input.replayLesson ? npc.repeatDialogueId : npc.dialogueId;
  return enterNode(npc.id, nodeId, deps, []);
}

/** True when this NPC has a lesson the player has already completed. */
export function hasCompletedLesson(npcId: string, player: PlayerState, content: ContentIndex): boolean {
  const npc = content.npc(npcId);
  return npc.grammarTopicId !== null && isGrammarLearned(player, npc.grammarTopicId);
}

/**
 * Advances one step: next line, then practice, then the following node, then end.
 */
export function advanceDialogue(state: DialogueState, deps: DialogueDeps): DialogueState {
  if (state.phase === "ended") return state;

  if (state.phase === "practice-feedback") {
    return nextPractice({ ...state, feedback: null }, deps);
  }

  if (state.phase === "lines") {
    const current = node(state, deps);
    if (state.lineIndex + 1 < current.lines.length) {
      return { ...state, lineIndex: state.lineIndex + 1 };
    }
    return beginPracticeOrLeave(state, deps);
  }

  return state;
}

function beginPracticeOrLeave(state: DialogueState, deps: DialogueDeps): DialogueState {
  const current = node(state, deps);
  if (current.practiceQuestionIds.length > 0) {
    const question = deps.content.question(current.practiceQuestionIds[0] as string);
    return { ...state, phase: "practice", practiceIndex: 0, currentPractice: presentQuestion(question, deps.rng) };
  }
  return leaveNode(state, deps);
}

function nextPractice(state: DialogueState, deps: DialogueDeps): DialogueState {
  const current = node(state, deps);
  const next = state.practiceIndex + 1;
  if (next < current.practiceQuestionIds.length) {
    const question = deps.content.question(current.practiceQuestionIds[next] as string);
    return { ...state, phase: "practice", practiceIndex: next, currentPractice: presentQuestion(question, deps.rng) };
  }
  return leaveNode(state, deps);
}

function leaveNode(state: DialogueState, deps: DialogueDeps): DialogueState {
  const current = node(state, deps);
  if (current.next !== null) {
    const next = enterNode(state.npcId, current.next, deps, state.masteryEvents);
    // A conversation teaches whatever any of its nodes teaches, so carry it forward.
    return { ...next, teachesGrammarId: next.teachesGrammarId ?? state.teachesGrammarId };
  }
  return { ...state, phase: "ended", currentPractice: null, feedback: null };
}

/**
 * Answers one practice question.
 *
 * Mastery is recorded exactly as it is in battle — practice is real learning, not a warm-up.
 * What does NOT happen is damage: this function cannot touch HP, because FR-038 says an NPC
 * lesson costs nothing and the cheapest way to guarantee that is to make it unreachable.
 */
export function answerPractice(
  state: DialogueState,
  optionIndex: number,
  player: PlayerState,
  deps: DialogueDeps,
): { state: DialogueState; player: PlayerState; correct: boolean } {
  if (state.phase !== "practice" || !state.currentPractice) {
    throw new Error(`answerPractice called while phase is '${state.phase}'`);
  }

  const question = state.currentPractice;
  const correct = gradeAnswer(question, optionIndex);

  const existing = player.mastery[question.wordId] ?? initMastery(deps.content.word(question.wordId));
  const wasMastered = existing.components[question.component]?.mastered ?? false;
  const wordWasMastered = isWordMastered(existing);
  const updated = recordAnswer(existing, question.component, correct, deps.balance);
  const nowMastered = updated.components[question.component]?.mastered ?? false;

  const event: MasteryEvent = {
    wordId: question.wordId,
    componentId: question.component,
    correct,
    masteredNow: !wasMastered && nowMastered,
    demoted: wasMastered && !nowMastered,
    wordMasteredNow: !wordWasMastered && isWordMastered(updated),
  };

  return {
    state: {
      ...state,
      phase: "practice-feedback",
      // In character, right or wrong — the NPC tells you what it should have been.
      feedback: { correct, correctOption: correctOptionText(question), explanation: question.explanation },
      masteryEvents: [...state.masteryEvents, event],
    },
    player: { ...player, mastery: { ...player.mastery, [question.wordId]: updated } },
    correct,
  };
}

/** FR-036: the topic is recorded as learned once, on first completion. */
export function completeDialogue(state: DialogueState, player: PlayerState): PlayerState {
  const topic = state.teachesGrammarId;
  return topic === null ? player : learnGrammar(player, topic);
}

export function currentLine(state: DialogueState, deps: DialogueDeps): Localized {
  const current = node(state, deps);
  return current.lines[state.lineIndex] ?? (current.lines[0] as Localized);
}
