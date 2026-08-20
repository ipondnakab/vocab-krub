# Phase 0 Research: Chapter 2 — Content Scale

**Feature**: `002-chapter2-content-scale` | **Date**: 2026-08-20

Feature 001 resolved the stack questions (R-001…R-017 in its research). Those decisions stand and
are not revisited. What follows is only what Chapter 2 raises that Chapter 1 did not.

Several entries below are conclusions from defects that actually happened while building Chapter
1, which is the most reliable evidence available.

---

## R-101: How chapter content gets authored

**Resolves**: FR-008.

**Decision**: A guided command-line tool, `npm run author`, that prompts for a word and writes the
full content set into the existing JSON files. Hand-editing stays supported and the JSON stays the
single source of truth — the tool writes exactly what a person could write by hand.

**Rationale**: Chapter 1's 177 questions were only tractable because a throwaway script generated
them. That script was deliberately not committed, because feature 001 listed content authoring
tools as Out of Scope — correct for a one-chapter slice, wrong at chapter scale. Chapter 2 is
~40 words, which at 6 mastery components each is roughly 240 questions before review material.

Asking a person to hand-write 240 four-option questions with explanations in two languages is not
a test of the authoring hypothesis; it is a test of their patience.

**What the tool must NOT be**: a new format. If the tool ever writes something a hand-editor
cannot read and modify, there are two sources of truth and Principle III is broken in a way that
is hard to see and expensive to unwind.

**Alternatives rejected**:

- *Hand-edited JSON only* — the status quo. Almost certainly fails SC-001 on volume.
- *Spreadsheet import* — genuinely more accessible to a teacher, who already lives in a
  spreadsheet. Rejected for now because it adds a second format to validate and keep in sync. It
  is the natural next step once the author is someone other than the project owner, and the CLI
  does not preclude it.
- *A web-based content editor* — far more work than the hypothesis needs, and it would become a
  product to maintain rather than a tool to use.

---

## R-102: What the authoring tool generates, and what it refuses

**Resolves**: FR-006 (placeholder art for new entities), and enforces FR-003 through FR-005 at
authoring time.

**Decision**: The tool prompts for the parts only a human can supply — the word, its meaning in
both languages, its forms, and one example sentence — and derives the rest: mastery components,
one question per component, difficulty tiers, grammar dependencies, and distractors.

Crucially it **refuses** to emit content that Chapter 1 proved is broken:

| Refusal | Why it exists |
|---|---|
| A word whose forms are spelled identically | `read`/`read`/`read` cannot be a multiple-choice question. Chapter 1 hit this and the word had to be dropped. |
| A monster with fewer than 2 ungated questions | A first battle fought before any lesson ran out of askable questions and threw. Chapter 1 hit this too. |
| A third-person distractor built by appending `s` | Produced "I gos every day." A non-word is a weak distractor; the mistake a learner actually makes is the one worth offering. |
| A component with no question | That component could never be mastered, so the word could never reach 100%. |

**Rationale**: Every one of those is a real defect from Chapter 1, found late — two of them only
by playing. Encoding them as refusals in the tool means the next author cannot repeat them, and
FR-003 through FR-005 already require validation to catch them as a second line of defence.

**Alternatives rejected**:

- *Generate freely and rely on validation* — validation catches these, but only after the author
  has written everything. Refusing at the point of authoring is faster and teaches the rule.

---

## R-103: Chapter ordering and progression

**Decision**: Chapters declare an explicit `requiresChapterId`. A chapter is available when its
prerequisite is `completed`. `ChapterProgress` already records `completed` per chapter, so this
adds one authored field and one query — no new state.

**Rationale**: Chapter 1 shipped `ChapterProgress` keyed by chapter id precisely so a second
chapter would not need a new shape. This is the first use of that, and it fits.

Ordering lives in content rather than in code, per Principle III: a designer reordering chapters
or inserting a side chapter should not need an engineer.

**Alternatives rejected**:

- *Implicit ordering by array position* — fragile, and silently reorders when someone sorts the
  file.
- *A numeric `order` field* — requires renumbering to insert a chapter between two others.

---

## R-104: Cross-chapter review

**Resolves**: FR-015, FR-016.

**Decision**: No new mechanism. Question selection already draws review questions from any word
the player has `encountered`, regardless of which chapter declared it, at
`balance.questions.reviewProportion`.

**Rationale**: This is worth stating precisely because it is the pleasant surprise of this
feature. The review pool was never scoped to a chapter — it is keyed off `encountered` on the
player's mastery record, which spans chapters by construction. Chapter 1 words will start
appearing in Chapter 2 battles with **zero** code changes.

What this feature must do is *verify* that, not build it. SC-006 measures it at 25%.

**One thing to watch**: the review pool grows with every chapter. At Chapter 2 it is ~40 extra
words; the selection algorithm weights and normalises rather than scanning exhaustively per turn,
so this is not yet a performance concern. It becomes one somewhere around chapter 6, and that is
the right time to address it, not now.

---

## R-105: A word declared by more than one chapter

**Decision**: Mastery is keyed by word id, not by chapter, so a word appearing in two chapters has
exactly one mastery record and counts once toward equipment unlocks. Content validation warns when
two chapters declare the same word, because it is more often a mistake than an intention.

**Rationale**: FR-013 requires the single-count behaviour, and the existing data model already
gives it — `wordsMasteredCount` counts distinct entries in `player.mastery`. The validation warning
exists because a duplicated word usually means an author copied a block, not that they deliberately
revisited it.

---

## R-106: Saves written before Chapter 2 existed

**Decision**: No migration needed. `ChapterProgress` is a map keyed by chapter id; a save that has
never seen `chapter-2` simply has no entry, and `chapterProgressOf` already returns a zeroed
default for a missing key.

**Rationale**: Verified against the shipped code rather than assumed —
`chapterProgressOf(player, chapterId)` returns a default record when the key is absent, which was
written for exactly this case. The save `schemaVersion` therefore does not change, and FR-011 is
satisfied by existing behaviour plus a test.

**Alternatives rejected**:

- *Bump the schema version and write a migration* — unnecessary, and a migration that does nothing
  is worse than no migration: it implies a change happened.

---

## R-107: Journal readability at 70+ words

**Decision**: Add grouping and a filter to the word journal — by chapter, and by state (mastered /
in progress / not started). No search box.

**Rationale**: SC-010 asks a playtester to find a specific word in under 15 seconds. At 31 words
the current flat list is fine; at 70+ it is a scroll. Grouping by chapter matches how the player
learned them, and a mastered/in-progress filter answers the question players actually ask, which
is "what do I still not know?"

A search box was rejected for now: it needs a text input, and the anti-quiz test (T127 in 001)
forbids native form controls in the game UI on Principle I grounds. A filter built from the same
menu buttons the rest of the game uses stays consistent. If search proves necessary, it needs a
styled control, not an `<input>` dropped into an RPG.

---

## R-108: What Chapter 2 teaches

**Resolves**: FR-014, FR-018.

**Decision**: Chapter 2 stays at **A1**. Grammar is Present Continuous (`I am going`) and question
forms with `do`/`does` (`Do you go to school?`).

**Rationale**: The concept document places chapters 1–3 at A1 and 4–6 at A2. Chapter 2 broadens
A1 rather than advancing the level — this corrects an earlier assumption in conversation that
Chapter 2 would be A2.

Both topics are natural successors to what Chapter 1 taught. Present Continuous reuses the
`present-participle` form that Chapter 1's words already declare, so it tests existing vocabulary
in a new way rather than requiring all-new words — which is exactly the cross-chapter reinforcement
the concept document asks for.

---

## Resolved Unknowns Summary

| ID | Question | Resolution |
|---|---|---|
| R-101 | How is content authored at chapter scale? | A guided CLI writing the same JSON a human would; hand-editing stays the source of truth |
| R-102 | What does the tool refuse to emit? | Every content defect Chapter 1 actually hit — homograph forms, all-gated pools, fake `-s` distractors, uncovered components |
| R-103 | How is chapter order expressed? | An authored `requiresChapterId`, gating on the existing `completed` flag |
| R-104 | How does cross-chapter review work? | It already does — the review pool keys off `encountered`, not chapter. Verify, do not build |
| R-105 | A word in two chapters? | One mastery record, counted once; validation warns because it is usually a copy-paste |
| R-106 | Do old saves migrate? | No. A missing chapter key already returns a zeroed default |
| R-107 | Journal at 70+ words? | Group by chapter, filter by state. No search box — it would need a form control |
| R-108 | What does Chapter 2 teach? | Still A1: Present Continuous and do/does questions |

**Deferred, not resolved**: FR-021, when the Stage 2 open world unlocks. It is a constitution
amendment and does not block this feature.
