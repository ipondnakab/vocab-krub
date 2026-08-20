import type { BalanceConfig, VocabularyWord } from "../../content/schemas/index";
import { deriveComponents } from "../content/deriveComponents";
import type { ComponentMastery, PlayerState, WordMastery } from "../player/playerState";

/**
 * Vocabulary mastery (FR-023 … FR-029, research R-005).
 *
 * This module is where Constitution Principle IV — Pedagogical Honesty — actually lives.
 *
 * A component is mastered only after `streakRequired` CONSECUTIVE correct answers. With
 * four options, a single lucky guess is 25%; two in a row is ~6%; across a whole word's
 * components, mastering by chance becomes negligible. That is the entire point: mastery has to
 * mean something, or the product's claim is hollow.
 *
 * A miss on a mastered component DEMOTES it to one correct answer short of restoration rather
 * than zeroing it (FR-025). Forgetting once is a speed bump, not a punishment — and it creates
 * the review pressure that makes revisited words meaningful.
 */

export function initComponentMastery(): ComponentMastery {
  return { streak: 0, mastered: false, attempts: 0, correct: 0 };
}

export function initMastery(word: VocabularyWord): WordMastery {
  const components: Record<string, ComponentMastery> = {};
  for (const id of deriveComponents(word)) components[id] = initComponentMastery();
  return { wordId: word.id, components, encountered: false };
}

/**
 * Records one answer against one component.
 *
 * Pure: returns new state, never mutates. The ONLY place promotion and demotion happen.
 */
export function recordAnswer(
  mastery: WordMastery,
  componentId: string,
  correct: boolean,
  balance: BalanceConfig,
): WordMastery {
  const existing = mastery.components[componentId];
  if (existing === undefined) {
    throw new Error(`Word '${mastery.wordId}' has no mastery component '${componentId}'`);
  }

  const required = balance.mastery.streakRequired;
  let streak: number;

  if (correct) {
    streak = existing.streak + 1;
  } else if (existing.mastered) {
    // Demote, never zero (FR-025). One correct review answer restores it.
    streak = Math.max(0, required - 1);
  } else {
    streak = 0;
  }

  const updated: ComponentMastery = {
    streak,
    mastered: streak >= required,
    attempts: existing.attempts + 1,
    correct: existing.correct + (correct ? 1 : 0),
  };

  return {
    ...mastery,
    components: { ...mastery.components, [componentId]: updated },
  };
}

export function markEncountered(mastery: WordMastery): WordMastery {
  return mastery.encountered ? mastery : { ...mastery, encountered: true };
}

/** Mastered components ÷ total components. Exactly 1 means MASTERED (FR-026). */
export function masteryPercent(mastery: WordMastery): number {
  const ids = Object.keys(mastery.components);
  if (ids.length === 0) return 0;
  const mastered = ids.filter((id) => mastery.components[id]?.mastered).length;
  return mastered / ids.length;
}

export function isWordMastered(mastery: WordMastery): boolean {
  const ids = Object.keys(mastery.components);
  return ids.length > 0 && ids.every((id) => mastery.components[id]?.mastered === true);
}



/** Drives equipment unlock thresholds (FR-044). */
export function wordsMasteredCount(player: PlayerState): number {
  return Object.values(player.mastery).filter(isWordMastered).length;
}

export function encounteredWordIds(player: PlayerState): string[] {
  return Object.values(player.mastery)
    .filter((m) => m.encountered)
    .map((m) => m.wordId);
}
