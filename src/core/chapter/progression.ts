import type { Chapter } from "../../content/schemas";
import type { ContentIndex } from "../content/loadContent";
import type { PlayerState } from "../player/playerState";
import { chapterProgressOf } from "./challenge";

/**
 * Chapter ordering (FR-009, contracts/chapter-ordering.md).
 *
 * Availability is DERIVED, never stored. A content edit that reorders the campaign must take
 * effect immediately rather than after the next save — storing it would let it go stale.
 */

/** A chapter with no prerequisite is always available; otherwise its prerequisite must be done. */
export function isChapterAvailable(
  player: PlayerState,
  chapterId: string,
  content: ContentIndex,
): boolean {
  const chapter = content.chapter(chapterId);
  if (chapter.requiresChapterId === null) return true;
  return chapterProgressOf(player, chapter.requiresChapterId).completed;
}

/**
 * The chapter standing in the way, or null when the chapter is already available.
 *
 * Exists so the player can be told WHAT to finish rather than simply being refused. A gate that
 * does not say what it wants is a wall.
 */
export function blockedBy(
  player: PlayerState,
  chapterId: string,
  content: ContentIndex,
): Chapter | null {
  const chapter = content.chapter(chapterId);
  if (chapter.requiresChapterId === null) return null;
  if (chapterProgressOf(player, chapter.requiresChapterId).completed) return null;
  return content.chapter(chapter.requiresChapterId);
}

/** The first available chapter the player has not yet completed. */
export function nextChapter(player: PlayerState, content: ContentIndex): Chapter | null {
  return (
    content.chapters.find(
      (chapter) =>
        isChapterAvailable(player, chapter.id, content) &&
        !chapterProgressOf(player, chapter.id).completed,
    ) ?? null
  );
}

/** Completing a chapter never locks it — earlier maps stay open for practice (FR-012). */
export function isChapterReplayable(player: PlayerState, chapterId: string): boolean {
  return chapterProgressOf(player, chapterId).completed;
}
