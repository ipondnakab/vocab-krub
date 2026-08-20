# Implementation Plan: Chapter 2 — Content Scale

**Branch**: `002-chapter2-content-scale` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-chapter2-content-scale/spec.md`

## Summary

Deliver a playable Chapter 2, and in doing so answer the question the product's whole roadmap
depends on: **can a chapter be authored without an engineer?**

The technical work divides unevenly, and that is the point. Most of Chapter 2 is *content* running
on systems Chapter 1 already ships — cross-chapter review, for instance, already works and only
needs verifying. The genuinely new engineering is small and specific: a guided authoring tool,
chapter-to-chapter gating, and a journal that stays usable at 70+ words.

If this feature turns out to be mostly authoring time and very little code, that is a successful
result, not a disappointing one.

## Technical Context

**Language/Version**: Unchanged — TypeScript 5.9.3 strict, Node.js 24 LTS

**Primary Dependencies**: Unchanged — Next.js 16, React 19, Phaser 3.90.0, Zod 4, ESLint 10. **No
new runtime dependency.** The authoring tool is a Node script using the same Zod schemas the game
validates with.

**Storage**: Unchanged — `localStorage` behind `SaveRepository`. **No save schema change** (R-106).

**Testing**: Unchanged — Vitest, Node environment, no browser. Coverage thresholds already in
place must hold with two chapters of content loaded.

**Target Platform**: Unchanged.

**Performance Goals**: The full test suite must still finish under 30 seconds with roughly double
the content (SC-008). Question selection must stay responsive as the review pool grows.

**Constraints**: Chapter 2 introduces **no new question type and no new battle mechanic**
(FR-020), so any schedule overrun is attributable to the content pipeline rather than to new code
— which is the measurement this feature exists to take.

**Scale/Scope**: ~40 new A1 words, ~240 new questions, 2 new grammar topics, 3 new maps, 6 new
NPCs, 6 new monsters plus a boss, 1 chapter challenge. Both locales complete.

**Explicitly absent**: Stage 2, Socket.IO, accounts, spaced repetition, free-text answers, A2
content, and any new battle mechanic.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Vocab Krub Constitution **v1.1.0**.

| Principle | Gate | Status |
|---|---|---|
| I. Game First, Quiz Never | Does new content stay diegetic? Does anything drift toward a quiz? | **PASS** — Chapter 2 reuses Chapter 1's presentation wholesale: lessons inside dialogue, a gatekeeper at a gate, visible encounters. R-107 explicitly rejects a journal search box because it would need a native form control, which the anti-quiz test forbids. |
| II. Separation of Engine, Rules, and Rendering | Does new work respect the layering? | **PASS** — Chapter gating is a pure query in `src/core/chapter/`. The authoring tool lives in `scripts/` and touches only content files and schemas; it imports nothing from `src/phaser` or `src/components`. Journal grouping is presentation over existing state. |
| III. Content Is Data, Not Code | Can the chapter be added without engine changes? Is ordering data? | **PASS, and it is the point** — the entire feature is a test of this principle. Chapter order is an authored `requiresChapterId`, not code (R-103). SC-002 verifies zero source changes by inspecting the change set. |
| IV. Pedagogical Honesty | Does mastery stay component-scoped? Does anything overstate the level? | **PASS** — no change to mastery rules. R-108 corrects Chapter 2 to A1 rather than A2, which matters: labelling A1 content as A2 would be exactly the kind of overstatement this principle forbids. A word in two chapters counts once (R-105). |
| V. Test Every Rule That Changes Player State | Do new rules have tests? | **PASS** — chapter gating changes what a player can reach and gets tests for both states, the boundary, and a pre-Chapter-2 save. Authoring-tool refusals get tests. Cross-chapter review gets a measurement test (SC-006). |
| VI. Vertical Slice Discipline | Any speculative abstraction? Any building ahead? | **PASS with one deliberate reversal, recorded below** — 001 declared content authoring tools Out of Scope. This feature builds one. That boundary was right for a single chapter and is wrong at chapter scale; the reversal is argued in Complexity Tracking rather than done quietly. Nothing is built for Stage 2, chapters 3+, or A2. |
| VII. Preserve Working Behavior | Does Chapter 1 still work? Do old saves survive? | **PASS** — Chapter 1 content and its tests are untouched. No save schema change (R-106), verified against the shipped `chapterProgressOf` default rather than assumed. |
| Product Shape: Two Stages | Is Stage 2 kept out? | **PASS** — nothing here builds, stubs, or configures Stage 2. FR-021 asks *when it unlocks* and is deferred to a constitution amendment; Chapter 2 behaves identically under all three candidate answers. |

**Result**: All gates pass. Proceed to Phase 0.

**Post-Phase-1 re-check**: All gates still pass. Phase 1 added no rule outside `src/core/`, no
tunable outside `balance.json`, and no new save state.

## Project Structure

### Documentation (this feature)

```text
specs/002-chapter2-content-scale/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 — R-101…R-108
├── data-model.md        # Phase 1 — what changes, and what deliberately does not
├── quickstart.md        # Phase 1 — how to author a chapter, end to end
├── contracts/
│   ├── authoring-cli.md     # What the tool prompts for, emits, and refuses
│   └── chapter-ordering.md  # How one chapter gates another
├── checklists/
│   └── requirements.md  # 16/16
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

Almost nothing moves. Listing only what this feature touches:

```text
scripts/
└── author.ts                    # NEW — the guided authoring CLI (R-101, R-102)

src/
├── core/
│   ├── chapter/
│   │   ├── challenge.ts         # unchanged
│   │   └── progression.ts       # NEW — chapter availability and ordering (R-103)
│   └── content/
│       ├── validate.ts          # EXTENDED — duplicate-word warning, ordering integrity
│       └── loadContent.ts       # unchanged
│
├── content/
│   ├── schemas/chapters.ts      # EXTENDED — requiresChapterId
│   └── data/                    # ALL Chapter 2 content lands here
│
└── components/journal/
    └── WordJournal.tsx          # EXTENDED — group by chapter, filter by state (R-107)

tests/
├── unit/chapterProgression.test.ts   # NEW
├── unit/authoring.test.ts            # NEW — the refusal rules
├── integration/cross-chapter.test.ts # NEW — review proportion, save compatibility
└── content/                          # existing suites now cover both chapters
```

**Structure Decision**: No new layer, no new package, no new dependency. The authoring tool sits
in `scripts/` alongside `generate-placeholders.ts`, which already establishes that pattern — a
Node script that reads content and writes conforming files, run through an npm script, never
imported by the game.

## Phase Outputs

- **Phase 0** — [research.md](./research.md): R-101 through R-108. Several are conclusions drawn
  from defects Chapter 1 actually hit, which is the most reliable evidence available.
- **Phase 1** — [data-model.md](./data-model.md), [contracts/](./contracts/),
  [quickstart.md](./quickstart.md).
- **Phase 2** — `tasks.md`, produced by `/speckit-tasks`.

## Complexity Tracking

> Filled only where the Constitution Check surfaced something needing justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| **Building a content authoring tool, which feature 001 explicitly placed Out of Scope** | 001's boundary was correct for a 31-word slice and is wrong at ~40 words and ~240 questions. More to the point, this feature's entire hypothesis is whether a person can author a chapter — and Chapter 1's content only got written because a throwaway script generated it. Testing the hypothesis with hand-editing would measure patience, not feasibility. The reversal is scoped: the tool writes the same JSON a human writes, so there is no second source of truth. | *Hand-edited JSON* was the status quo and is the thing under suspicion. *A spreadsheet import* is genuinely more accessible to a teacher and remains the next step, but adds a second format to keep in sync — worth doing when the author is not the project owner, not before. |
| Extending the journal with grouping and filters | SC-010 requires finding a word in under 15 seconds at 70+ words. A flat list that was fine at 31 is a scroll at 70, and it will be a scroll at 110 in Chapter 3. | *Leave it flat* fails SC-010. *Add a search box* needs a text input, which the anti-quiz test forbids in the game UI on Principle I grounds — a styled control would be needed, and that is more work than grouping for less benefit at this size. |
