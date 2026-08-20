import { describe, expect, it } from "vitest";
import {
  blockedBy, isChapterAvailable, isChapterReplayable, nextChapter,
} from "../../src/core/chapter/progression";
import { chapterProgressOf, recordBossDefeated } from "../../src/core/chapter/challenge";
import { content, player } from "../helpers/fixtures";
import type { ContentIndex } from "../../src/core/content/loadContent";
import type { Chapter } from "../../src/content/schemas";
import type { PlayerState } from "../../src/core/player/playerState";

/** A two-chapter index built over the real Chapter 1, so ordering is testable before Chapter 2 exists. */
function twoChapters(): ContentIndex {
  const one = content.chapter("chapter-1");
  const two: Chapter = { ...one, id: "chapter-2", requiresChapterId: "chapter-1" };
  const chapters = [one, two];
  return {
    ...content,
    chapters,
    chapter: (id: string) => {
      const found = chapters.find((c) => c.id === id);
      if (!found) throw new Error(`Unknown chapter id: '${id}'`);
      return found;
    },
  };
}

const completed = (p: PlayerState, chapterId: string): PlayerState => ({
  ...p,
  chapterProgress: {
    ...p.chapterProgress,
    [chapterId]: { ...chapterProgressOf(p, chapterId), completed: true },
  },
});

describe("chapter availability (FR-009)", () => {
  const index = twoChapters();

  it("always makes the entry-point chapter available", () => {
    expect(isChapterAvailable(player(), "chapter-1", index)).toBe(true);
  });

  it("withholds a chapter until its prerequisite is COMPLETED", () => {
    // Defeating the boss is not enough — the challenge must be passed.
    const bossOnly = recordBossDefeated(player(), "chapter-1");
    expect(isChapterAvailable(bossOnly, "chapter-2", index)).toBe(false);
  });

  it("opens the chapter once its prerequisite is completed", () => {
    expect(isChapterAvailable(completed(player(), "chapter-1"), "chapter-2", index)).toBe(true);
  });
});

describe("telling the player what is missing (FR-009)", () => {
  const index = twoChapters();

  it("names the blocking chapter rather than returning a bare false", () => {
    // A gate that does not say what it wants is a wall.
    const blocker = blockedBy(player(), "chapter-2", index);
    expect(blocker?.id).toBe("chapter-1");
    expect(blocker?.title.th.length).toBeGreaterThan(0);
  });

  it("reports nothing blocking once the prerequisite is done", () => {
    expect(blockedBy(completed(player(), "chapter-1"), "chapter-2", index)).toBeNull();
  });

  it("reports nothing blocking the entry point", () => {
    expect(blockedBy(player(), "chapter-1", index)).toBeNull();
  });
});

describe("finding the next chapter", () => {
  const index = twoChapters();

  it("points at the entry point for a new player", () => {
    expect(nextChapter(player(), index)?.id).toBe("chapter-1");
  });

  it("advances once the first chapter is complete", () => {
    expect(nextChapter(completed(player(), "chapter-1"), index)?.id).toBe("chapter-2");
  });

  it("returns null when everything is complete", () => {
    const all = completed(completed(player(), "chapter-1"), "chapter-2");
    expect(nextChapter(all, index)).toBeNull();
  });
});

describe("earlier chapters stay open (FR-012)", () => {
  it("marks a completed chapter replayable", () => {
    expect(isChapterReplayable(player(), "chapter-1")).toBe(false);
    expect(isChapterReplayable(completed(player(), "chapter-1"), "chapter-1")).toBe(true);
  });
});
