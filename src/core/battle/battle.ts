import type { BalanceConfig, Item, Localized } from "../../content/schemas/index";
import type { ContentIndex } from "../content/loadContent";
import { initMastery, isWordMastered, markEncountered, recordAnswer } from "../mastery/mastery";
import { applyDamage, type PlayerState } from "../player/playerState";
import { damageFor, incomingDamage } from "../questions/damage";
import { correctOptionText, gradeAnswer, presentQuestion, type PresentedQuestion } from "../questions/present";
import { selectQuestion } from "../questions/select";
import type { Rng } from "../rng/rng";

/**
 * Turn-based battle rules (FR-001 … FR-014).
 *
 * The rule the whole game rests on: ONE question resolves per turn, and it grants AT MOST ONE
 * attack opportunity. Correct → only the player acts. Wrong → only the monster acts. Because
 * exactly one side acts per turn, both HP totals can never reach zero simultaneously — the
 * "who wins a mutual kill" edge case cannot arise, by construction rather than by tie-break.
 *
 * No rendering, no Phaser, no React. Everything here runs in a plain Node test in microseconds,
 * which is what makes SC-006 (100% coverage of state-changing rules) affordable.
 */

export type BattlePhase = "awaiting-answer" | "showing-feedback" | "ended";
export type BattleOutcome = "victory" | "defeat" | "fled";

export interface MasteryEvent {
  wordId: string;
  componentId: string;
  correct: boolean;
  /** This answer pushed the component into mastered. */
  masteredNow: boolean;
  /** This answer knocked a mastered component back down (FR-025). */
  demoted: boolean;
  /** This answer completed the final component — the restoration moment (FR-026). */
  wordMasteredNow: boolean;
}

export interface Feedback {
  correctOption: string;
  explanation: Localized;
}

export interface BattleState {
  monsterId: string;
  monsterMaxHp: number;
  monsterHp: number;
  isBoss: boolean;
  /**
   * The authoritative player during the fight — not a mirror.
   *
   * data-model.md originally described BattleState as carrying a `playerHp` copy "written back
   * on end". Two copies of HP is exactly the desync the runtime bridge exists to prevent, and
   * mastery must be written per answer (FR-027) so a mid-battle quit keeps it. One object.
   */
  player: PlayerState;
  turn: number;
  phase: BattlePhase;
  currentQuestion: PresentedQuestion | null;
  askedQuestionIds: string[];
  lastQuestionId: string | null;
  /** Computed on a miss, applied only once feedback is dismissed (FR-004). */
  pendingMonsterDamage: number;
  feedback: Feedback | null;
  outcome: BattleOutcome | null;
  masteryEvents: MasteryEvent[];
  /** Pet ability budget for this battle (FR-042). Resets every fight. */
  petUsesRemaining: number;
  /** Option indices removed by a pet. NEVER includes the correct one. */
  eliminatedIndices: number[];
  /** Whether a `first-mistake-free` effect has already absorbed a miss this battle. */
  firstMistakeUsed: boolean;
}

export interface BattleDeps {
  content: ContentIndex;
  balance: BalanceConfig;
  rng: Rng;
}

export interface BattleTurnResult {
  state: BattleState;
  correct: boolean;
  damageDealt: number;
  damageTaken: number;
  feedback: Feedback | null;
  masteryEvents: MasteryEvent[];
  outcome: BattleOutcome | null;
}

export interface FleeResult {
  state: BattleState;
  escaped: boolean;
}

function equippedItem(
  player: PlayerState,
  slot: "weapon" | "armor" | "pet",
  content: ContentIndex,
): Item | null {
  const id = player.equipped[slot];
  return id === null ? null : content.item(id);
}

/** How many times the equipped pet may act this battle (FR-042). */
function petUses(player: PlayerState, content: ContentIndex): number {
  const pet = equippedItem(player, "pet", content);
  if (!pet) return 0;
  let uses = 0;
  for (const effect of pet.effects) {
    if (effect.kind === "reveal-wrong-option") uses += effect.usesPerBattle;
  }
  return uses;
}

/**
 * Whether an equipped `first-mistake-free` effect covers this particular miss.
 *
 * `scope: "grammar"` covers only questions that depend on a grammar topic — the Scholar's Robe
 * forgives you for fumbling a tense, not for forgetting what a word means.
 */
function firstMistakeCovers(player: PlayerState, question: PresentedQuestion, content: ContentIndex): boolean {
  for (const slot of ["weapon", "armor", "pet"] as const) {
    const item = equippedItem(player, slot, content);
    if (!item) continue;
    for (const effect of item.effects) {
      if (effect.kind !== "first-mistake-free") continue;
      if (effect.scope === "any") return true;
      if (effect.scope === "grammar" && question.requiresGrammar !== null) return true;
    }
  }
  return false;
}

/** Review words may have no mastery record yet; create it on first sight rather than throwing. */
function ensureMastery(player: PlayerState, wordId: string, content: ContentIndex): PlayerState {
  if (player.mastery[wordId]) return player;
  return { ...player, mastery: { ...player.mastery, [wordId]: initMastery(content.word(wordId)) } };
}

function drawQuestion(state: BattleState, deps: BattleDeps): PresentedQuestion {
  const question = selectQuestion({
    monsterId: state.monsterId,
    player: state.player,
    content: deps.content,
    balance: deps.balance,
    rng: deps.rng,
    askedQuestionIds: state.askedQuestionIds,
    lastQuestionId: state.lastQuestionId,
  });
  return presentQuestion(question, deps.rng);
}

export function createBattle(input: {
  monsterId: string;
  player: PlayerState;
  content: ContentIndex;
  balance: BalanceConfig;
  rng: Rng;
}): BattleState {
  const deps: BattleDeps = { content: input.content, balance: input.balance, rng: input.rng };
  const monster = input.content.monster(input.monsterId);

  // Meeting a word puts it in the review pool from here on (FR-020).
  let player = ensureMastery(input.player, monster.wordId, input.content);
  player = {
    ...player,
    mastery: { ...player.mastery, [monster.wordId]: markEncountered(player.mastery[monster.wordId]!) },
  };

  const base: BattleState = {
    monsterId: monster.id,
    monsterMaxHp: monster.maxHp,
    monsterHp: monster.maxHp,
    isBoss: monster.isBoss,
    player,
    turn: 1,
    phase: "awaiting-answer",
    currentQuestion: null,
    askedQuestionIds: [],
    lastQuestionId: null,
    pendingMonsterDamage: 0,
    feedback: null,
    outcome: null,
    masteryEvents: [],
    petUsesRemaining: petUses(player, input.content),
    eliminatedIndices: [],
    firstMistakeUsed: false,
  };

  return { ...base, currentQuestion: drawQuestion(base, deps) };
}

/** Applies one answer to mastery and reports what changed. */
function applyMastery(
  player: PlayerState,
  question: PresentedQuestion,
  correct: boolean,
  balance: BalanceConfig,
  content: ContentIndex,
): { player: PlayerState; event: MasteryEvent } {
  const withRecord = ensureMastery(player, question.wordId, content);
  const before = withRecord.mastery[question.wordId]!;
  const wasMastered = before.components[question.component]?.mastered ?? false;
  const wordWasMastered = isWordMastered(before);

  const after = recordAnswer(before, question.component, correct, balance);
  const nowMastered = after.components[question.component]?.mastered ?? false;

  return {
    player: { ...withRecord, mastery: { ...withRecord.mastery, [question.wordId]: after } },
    event: {
      wordId: question.wordId,
      componentId: question.component,
      correct,
      masteredNow: !wasMastered && nowMastered,
      demoted: wasMastered && !nowMastered,
      wordMasteredNow: !wordWasMastered && isWordMastered(after),
    },
  };
}

function advance(state: BattleState, deps: BattleDeps): BattleState {
  return {
    ...state,
    turn: state.turn + 1,
    phase: "awaiting-answer",
    currentQuestion: drawQuestion(state, deps),
    feedback: null,
    pendingMonsterDamage: 0,
    // A new question means a fresh set of options; anything the pet removed is gone with it.
    eliminatedIndices: [],
  };
}

/**
 * Resolves one turn.
 *
 * Correct → the player attacks, the monster does not act this turn (FR-002).
 * Wrong   → NO damage yet. The state moves to `showing-feedback` carrying the correct answer and
 *           its explanation. The counterattack lands in `dismissFeedback`, because FR-004
 *           requires the player be taught BEFORE being hit. Ordering enforced by the state
 *           machine, not by UI politeness.
 */
export function submitAnswer(state: BattleState, optionIndex: number, deps: BattleDeps): BattleTurnResult {
  if (state.phase !== "awaiting-answer") {
    // Guarantees FR-010 even if a renderer mishandles input. A renderer that respects `phase`
    // never sees this.
    throw new Error(`submitAnswer called while phase is '${state.phase}'`);
  }
  const question = state.currentQuestion;
  if (!question) throw new Error("submitAnswer called with no current question");

  const correct = gradeAnswer(question, optionIndex);
  const { player, event } = applyMastery(state.player, question, correct, deps.balance, deps.content);

  const asked = state.askedQuestionIds.includes(question.questionId)
    ? state.askedQuestionIds
    : [...state.askedQuestionIds, question.questionId];

  const common = {
    ...state,
    player,
    askedQuestionIds: asked,
    lastQuestionId: question.questionId,
    masteryEvents: [...state.masteryEvents, event],
  };

  if (correct) {
    const damage = damageFor(question, equippedItem(player, "weapon", deps.content), deps.balance);
    const monsterHp = Math.max(0, state.monsterHp - damage);

    if (monsterHp <= 0) {
      const ended: BattleState = {
        ...common, monsterHp, phase: "ended", outcome: "victory", currentQuestion: null, feedback: null,
      };
      return { state: ended, correct: true, damageDealt: damage, damageTaken: 0, feedback: null,
        masteryEvents: [event], outcome: "victory" };
    }

    const next = advance({ ...common, monsterHp }, deps);
    return { state: next, correct: true, damageDealt: damage, damageTaken: 0, feedback: null,
      masteryEvents: [event], outcome: null };
  }

  const monster = deps.content.monster(state.monsterId);
  const armored = incomingDamage(monster.attack, equippedItem(player, "armor", deps.content));

  // FR-016 of Principle IV in practice: the effect softens the COST of being wrong. It never
  // hides that you were wrong — the feedback panel still runs, and mastery still records a miss.
  const forgiven = !state.firstMistakeUsed && firstMistakeCovers(player, question, deps.content);
  const pending = forgiven ? 0 : armored;

  const feedback: Feedback = { correctOption: correctOptionText(question), explanation: question.explanation };

  const showing: BattleState = {
    ...common,
    phase: "showing-feedback",
    feedback,
    pendingMonsterDamage: pending,
    firstMistakeUsed: state.firstMistakeUsed || forgiven,
  };
  return { state: showing, correct: false, damageDealt: 0, damageTaken: 0, feedback,
    masteryEvents: [event], outcome: null };
}

/** Resolves the monster's counterattack once the player has read why they were wrong. */
export function dismissFeedback(state: BattleState, deps: BattleDeps): BattleTurnResult {
  if (state.phase !== "showing-feedback") {
    throw new Error(`dismissFeedback called while phase is '${state.phase}'`);
  }

  const damage = state.pendingMonsterDamage;
  const hp = applyDamage(state.player.hp, damage, state.player.maxHp);
  const player = { ...state.player, hp };
  const hit = { ...state, player, feedback: null, pendingMonsterDamage: 0 };

  if (hp <= 0) {
    const ended: BattleState = { ...hit, phase: "ended", outcome: "defeat", currentQuestion: null };
    return { state: ended, correct: false, damageDealt: 0, damageTaken: damage, feedback: null,
      masteryEvents: [], outcome: "defeat" };
  }

  return { state: advance(hit, deps), correct: false, damageDealt: 0, damageTaken: damage,
    feedback: null, masteryEvents: [], outcome: null };
}

/**
 * FR-011 / FR-012. Bosses THROW rather than returning a failed flee — offering the option at all
 * is the bug, and a thrown error surfaces it in development instead of hiding as bad luck.
 */
export function attemptFlee(state: BattleState, deps: BattleDeps): FleeResult {
  if (state.isBoss) throw new Error(`Cannot flee boss battle '${state.monsterId}'`);
  if (state.phase !== "awaiting-answer") {
    throw new Error(`attemptFlee called while phase is '${state.phase}'`);
  }

  if (deps.rng.next() < deps.balance.battle.fleeSuccessChance) {
    // No rewards on escape — mastery already earned is kept, because it was applied per answer.
    return { state: { ...state, phase: "ended", outcome: "fled", currentQuestion: null }, escaped: true };
  }

  const monster = deps.content.monster(state.monsterId);
  const damage = incomingDamage(monster.attack, equippedItem(state.player, "armor", deps.content));
  const hp = applyDamage(state.player.hp, damage, state.player.maxHp);
  const player = { ...state.player, hp };

  if (hp <= 0) {
    return { state: { ...state, player, phase: "ended", outcome: "defeat", currentQuestion: null }, escaped: false };
  }
  // A failed escape costs the turn.
  return { state: advance({ ...state, player }, deps), escaped: false };
}

/**
 * Uses the pet's ability: removes exactly ONE incorrect option (FR-042).
 *
 * Constitution Principle IV, FR-043: this narrows the field, it never answers. The correct
 * option can never be eliminated, and at least two options always remain, so the player still
 * has to know something. If every wrong option is already gone, the ability refuses to fire
 * rather than wasting a use on nothing.
 */
export function usePetAbility(state: BattleState, deps: BattleDeps): BattleState {
  if (state.phase !== "awaiting-answer") {
    throw new Error(`usePetAbility called while phase is '${state.phase}'`);
  }
  if (state.petUsesRemaining <= 0) throw new Error("No pet ability uses remaining this battle");

  const question = state.currentQuestion;
  if (!question) throw new Error("usePetAbility called with no current question");

  const candidates = question.options
    .map((_, index) => index)
    .filter((index) => index !== question.correctIndex && !state.eliminatedIndices.includes(index));

  // Keep at least one wrong option standing, so a four-option question never collapses to one.
  if (candidates.length <= 1) return state;

  const removed = deps.rng.pick(candidates);
  return {
    ...state,
    petUsesRemaining: state.petUsesRemaining - 1,
    eliminatedIndices: [...state.eliminatedIndices, removed],
  };
}

export function endBattle(state: BattleState): PlayerState {
  if (state.phase !== "ended") throw new Error("endBattle called before the battle ended");
  return state.player;
}

export function isOver(state: BattleState): boolean {
  return state.phase === "ended";
}
