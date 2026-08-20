# Contract: Chapter Ordering

## Schema

```ts
Chapter {
  ...existing fields
  requiresChapterId: string | null   // null = campaign entry point
}
```

## Core API

```ts
isChapterAvailable(player: PlayerState, chapterId: string, content: ContentIndex): boolean
nextChapter(player: PlayerState, content: ContentIndex): Chapter | null
blockedBy(player: PlayerState, chapterId: string, content: ContentIndex): Chapter | null
```

`blockedBy` returns the chapter standing in the way, so the player can be told *what* to finish
rather than just being refused (FR-009). A gate that does not say what it wants is a wall.

## Rules

- A chapter with `requiresChapterId: null` is always available.
- Otherwise it is available exactly when the required chapter's `ChapterProgress.completed` is
  true.
- Availability is **derived, never stored** — a content edit that reorders chapters must take
  effect immediately, not after the next save.
- Completing a chapter does not lock the previous one. The player may return to earlier maps to
  practise against restored words (FR-012).

## Validation, at load time

| Rule | Failure mode it prevents |
|---|---|
| `requiresChapterId` resolves | A chapter nothing can ever unlock |
| No cycles in the graph | Two chapters each waiting on the other; the campaign has no entry |
| Exactly one chapter with `null` | Two entry points, or none |

All three fail the build with the file and field named, consistent with FR-002.

## Save compatibility

No schema change. A save written before Chapter 2 existed has no `chapter-2` key in
`chapterProgress`, and `chapterProgressOf` already returns a zeroed default for a missing key —
so an old save is simply a player who has not started Chapter 2 (R-106).

This must be covered by a test that loads a genuine pre-Chapter-2 save fixture, not a synthesised
one, so the compatibility claim is tested against reality.
