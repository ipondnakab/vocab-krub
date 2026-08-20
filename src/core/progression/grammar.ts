import type { ContentIndex } from "../content/loadContent";
import type { PlayerState } from "../player/playerState";

/**
 * Grammar the player has learned (FR-036, FR-018).
 *
 * Deliberately thin. It exists because two very different callers ask the same question —
 * dialogue records a topic on lesson completion, and question selection gates on it — and a
 * single named helper is clearer than the same `.includes()` written in both places.
 */
export function isGrammarLearned(player: PlayerState, topicId: string): boolean {
  return player.grammarLearned.includes(topicId);
}

export function learnGrammar(player: PlayerState, topicId: string): PlayerState {
  if (isGrammarLearned(player, topicId)) return player;
  return { ...player, grammarLearned: [...player.grammarLearned, topicId] };
}

/** Questions that became askable because of what the player now knows. */
export function unlockedQuestionCount(player: PlayerState, content: ContentIndex): number {
  return content.questions.filter(
    (q) => q.requiresGrammar !== null && isGrammarLearned(player, q.requiresGrammar),
  ).length;
}
