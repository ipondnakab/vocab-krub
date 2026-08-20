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

/** Which chapter a map belongs to. Maps are declared per chapter, so this is a content lookup. */
export function chapterOfMap(mapId: string, content: ContentIndex): Chapter | null {
  return content.chapters.find((c) => c.mapIds.includes(mapId)) ?? null;
}

/**
 * Whether the player may walk onto a map (FR-009).
 *
 * Chapter maps are chained end to end, so without this a player could stroll out of Chapter 1's
 * last map straight into Chapter 2. The gate lives on the map rather than on a separate
 * "enter chapter" action, because walking is how the player moves and a menu would be a seam.
 */
export function canEnterMap(
  player: PlayerState,
  mapId: string,
  content: ContentIndex,
): { allowed: true } | { allowed: false; blockedBy: Chapter } {
  const chapter = chapterOfMap(mapId, content);
  if (!chapter) return { allowed: true };
  if (isChapterAvailable(player, chapter.id, content)) return { allowed: true };
  const blocker = blockedBy(player, chapter.id, content);
  return blocker ? { allowed: false, blockedBy: blocker } : { allowed: true };
}

/** Completing a chapter never locks it — earlier maps stay open for practice (FR-012). */
export function isChapterReplayable(player: PlayerState, chapterId: string): boolean {
  return chapterProgressOf(player, chapterId).completed;
}
