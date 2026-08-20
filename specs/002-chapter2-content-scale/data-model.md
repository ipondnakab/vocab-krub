# Phase 1 Data Model: Chapter 2 — Content Scale

**Feature**: `002-chapter2-content-scale` | **Date**: 2026-08-20

The most useful thing this document can say is how little changes. Feature 001's
[data-model.md](../001-chapter1-vertical-slice/data-model.md) remains the reference; only the
deltas are here.

---

## 1. What changes

### Chapter — one new field

| Field | Type | Rules |
|---|---|---|
| `requiresChapterId` | `string \| null` | The chapter that must be `completed` before this one is available. `null` for the first chapter. Must reference an existing chapter, and the graph must be acyclic. |

That is the entire schema change in this feature. Chapter ordering becomes authored data rather
than code (R-103), so inserting a side chapter or reordering the campaign is a content edit.

**Validation added**:

- `requiresChapterId` resolves to a real chapter.
- No cycle — `chapter-1 → chapter-2 → chapter-1` fails at load, not at play.
- Exactly one chapter has `requiresChapterId: null`, so there is a single entry point.

### Content validation — one new warning

A word declared by more than one chapter produces a **warning**, not an error (R-105). It is legal
— a chapter may deliberately revisit a word — but it is far more often a copy-paste, and the
author should be told.

---

## 2. What deliberately does NOT change

This section exists because the instinct on a second chapter is to add state, and almost none is
needed.

| Concern | Why nothing changes |
|---|---|
| **Save schema** | `ChapterProgress` is a map keyed by chapter id. A save that never saw `chapter-2` has no entry, and `chapterProgressOf` already returns a zeroed default for a missing key — written for exactly this case and verified against the shipped code. `schemaVersion` stays at 1. A migration that does nothing is worse than none: it implies a change happened. |
| **Word mastery** | Keyed by word id, not by chapter. A word in two chapters has one record and counts once toward unlocks (FR-013) — `wordsMasteredCount` already counts distinct entries. |
| **Review pool** | Already spans chapters. Selection draws review questions from any word marked `encountered`, and `encountered` was never scoped to a chapter. Chapter 1 words will appear in Chapter 2 battles with zero code changes (R-104). This feature verifies that; it does not build it. |
| **Player progress carried forward** (FR-010) | Level, XP, gold, inventory, equipment, pet, and mastery live on `PlayerState`, which is chapter-agnostic. Entering a chapter reads nothing and resets nothing. |
| **Grammar learned** | A flat list of topic ids on the player. Chapter 2's topics append; Chapter 1's stay learned and are not re-taught (FR-017). |
| **Battle, question, mastery, reward rules** | Untouched. FR-020 forbids new mechanics precisely so that any overrun is attributable to content, not code. |
| **Balance config** | No new keys. Chapter 2 tunes monster HP and attack in `monsters.json`, which is per-monster data, not global balance. |

---

## 3. Derived, not stored

| Value | Derived from |
|---|---|
| `isChapterAvailable(player, chapterId)` | `requiresChapterId` is `null`, or that chapter's `completed` is true |
| `nextChapter(player)` | The first available chapter that is not yet `completed` |
| `chaptersOf(wordId)` | Scan of chapters declaring the word — used by the journal's grouping and by the duplicate warning |

None of these are persisted. Storing chapter availability would let it go stale the moment a
content edit changed the ordering.

---

## 4. Content volume, for planning

| | Chapter 1 (shipped) | Chapter 2 (target) | Combined |
|---|---|---|---|
| Vocabulary words (FR-014: ≥30 new) | 31 | ~40 | ~71 |
| Questions | 177 | ~240 | ~417 |
| Grammar topics | 2 | 2 | 4 |
| NPCs | 6 | 6 | 12 |
| Monsters | 8 | 7 | 15 |
| Maps | 3 | 3 | 6 |

Two numbers to watch as this lands:

- **The journal at ~71 words.** SC-010 asks a playtester to find a specific word in under 15
  seconds. R-107 adds grouping and filters for this.
- **The test suite at ~417 questions.** SC-008 keeps the 30-second cap. Content tests iterate over
  every question, so this scales linearly and there is headroom — Chapter 1's full suite runs in
  about a second — but it is worth measuring rather than assuming.
