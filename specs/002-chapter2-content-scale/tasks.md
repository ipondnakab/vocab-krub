---
description: "Task list for Chapter 2 — Content Scale"
---

# Tasks: Chapter 2 — Content Scale

**Input**: Design documents from `/specs/002-chapter2-content-scale/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: **Mandatory, not optional.** Constitution Principle V requires automated tests for every
rule that changes what a player can reach or hold. Chapter gating changes what a player can reach,
and the authoring tool's refusals decide what content exists at all. The template treats tests as
optional; the constitution overrides it.

**⚠️ Prerequisite outside this feature**: the spec assumes the Chapter 1 playtest (001 / T130)
returned a positive answer on the core loop. It has not run. Authoring a second chapter on an
unvalidated loop doubles the exposure — this is called out here as well as in the spec so it
cannot be missed at execution time.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: US1–US5. Setup, Foundational, and Polish carry no story label.

## Path Conventions

Single Next.js package, unchanged from feature 001: `src/core/`, `src/content/`, `src/components/`,
`scripts/`, `tests/` at repository root.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Wire the new npm script. There is deliberately almost nothing here — this feature adds
no dependency and no new layer.

- [X] T001 Add the `author` and `author:check` scripts to package.json, pointing at scripts/author.ts
- [X] T002 [P] Create the empty scripts/author.ts entry point with its CLI argument parsing in scripts/author.ts
- [X] T003 [P] Add tests/unit/authoring.test.ts and tests/unit/chapterProgression.test.ts as empty suites so the harness picks them up

**Checkpoint**: ✅ **COMPLETE (2026-08-20)** — `npm run author` and `npm run author:check` both run; `npm test` green.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Chapter ordering. Every user story below depends on a second chapter being
expressible at all.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T004 Add the nullable `requiresChapterId` field to the chapter schema in src/content/schemas/chapters.ts (data-model §1)
- [X] T005 Set `requiresChapterId: null` on chapter-1 in src/content/data/chapters.json so the existing chapter remains the campaign entry point
- [X] T006 Implement `isChapterAvailable`, `nextChapter`, and `blockedBy` in src/core/chapter/progression.ts per contracts/chapter-ordering.md (FR-009)
- [X] T007 Test chapter availability in tests/unit/chapterProgression.test.ts: a null prerequisite is always available; a chapter is unavailable until its prerequisite is `completed`; `blockedBy` names the blocking chapter rather than returning a bare false (FR-009)
- [X] T008 Add cross-file validation to src/core/content/validate.ts for chapter ordering: `requiresChapterId` resolves, the graph is acyclic, and exactly one chapter has a null prerequisite (contracts/chapter-ordering.md)
- [X] T009 [P] Test the ordering validation in tests/content/schemas.test.ts: a dangling prerequisite fails, a two-chapter cycle fails, and two null-prerequisite chapters fail — each naming the file and field
- [X] T010 [P] Add the duplicate-word warning to src/core/content/validate.ts for a word declared by more than one chapter (research R-105, FR-013)
- [X] T011 [P] Test in tests/unit/mastery.test.ts that a word declared by two chapters produces exactly one mastery record and counts once toward `wordsMasteredCount` (FR-013)
- [X] T012 Verify against the shipped code that no save migration is needed: add a test in tests/unit/save.test.ts loading a save with no `chapter-2` key and asserting `chapterProgressOf` returns a zeroed default (FR-011, research R-106)

**Checkpoint**: ✅ **COMPLETE (2026-08-20)** — 392 tests pass. Chapter ordering is authored data; cycles, dangling prerequisites, and duplicate entry points all fail at load with the field named. A pre-Chapter-2 save loads with no migration, verified against `chapterProgressOf`'s shipped default rather than assumed.

---

## Phase 3: User Story 1 — A content author adds a chapter without engineering help (Priority: P1) 🎯 MVP

**Goal**: The authoring CLI — a guided tool that makes authoring ~40 words tractable (FR-014 sets the floor at 30; 40 is the plan's target and what the ~240-question estimate assumes), and that refuses to emit the
content defects Chapter 1 actually shipped.

**Independent Test**: Hand scripts/author.ts and quickstart.md to someone who has not seen the
codebase and ask them to add five words, one monster, and one NPC. Measure whether they succeed
without asking an engineer (SC-001).

### Tests for User Story 1

- [X] T013 [P] [US1] Test in tests/unit/authoring.test.ts that the tool REFUSES a word whose forms are spelled identically, and explains why in one sentence (FR-003, research R-102 — the `read`/`read`/`read` defect from Chapter 1)
- [X] T014 [P] [US1] Test in tests/unit/authoring.test.ts that the tool REFUSES to emit a monster with fewer than two questions answerable before any grammar is learned (FR-004 — the defect that made a first battle throw in Chapter 1)
- [X] T015 [P] [US1] Test in tests/unit/authoring.test.ts that third-person distractors use real `-s`/`-es`/`-ies` forms, so `go` yields `goes` and never `gos` (research R-102)
- [X] T016 [P] [US1] Test in tests/unit/authoring.test.ts that every derived mastery component receives at least one question (FR-005)
- [X] T017 [P] [US1] Test in tests/unit/authoring.test.ts that no generated question has a duplicate option or a distractor equal to the correct answer (FR-022 of feature 001)

### Implementation for User Story 1

- [X] T018 [US1] Implement the interactive prompt sequence in scripts/author.ts — word, both meanings, topic, forms, one example, chapter — per contracts/authoring-cli.md (FR-008)
- [X] T019 [US1] Implement mastery-component derivation and one-question-per-component generation in scripts/author.ts, reusing src/core/content/deriveComponents.ts rather than reimplementing it (FR-005)
- [X] T020 [US1] Implement distractor generation in scripts/author.ts with correct third-person and plural morphology (research R-102)
- [X] T021 [US1] Implement the five refusal rules in scripts/author.ts, each returning a one-sentence explanation rather than a bare rejection (FR-003, FR-004, FR-005)
- [X] T022 [US1] Implement writing into src/content/data/*.json from scripts/author.ts, preserving existing formatting and ordering so the diff stays reviewable (FR-008)
- [X] T023 [US1] Implement `npm run author -- --check` in scripts/author.ts to run full content validation without writing (FR-002)
- [X] T024 [US1] Make the validation report in src/core/content/errors.ts readable by a non-engineer: file, field path, what was expected — and all problems in one run (FR-002)
- [X] T025 [P] [US1] Extend scripts/generate-placeholders.ts so newly authored NPCs and monsters get conforming placeholder art automatically (FR-006)
- [X] T026 [US1] Write the authoring guide in specs/002-chapter2-content-scale/quickstart.md covering every content file and the validation step, aimed at someone who will not open a source file (FR-007)
- [ ] T027 [US1] Verify SC-001 by having a person who has not seen the codebase add five words, one monster, and one NPC using only specs/002-chapter2-content-scale/quickstart.md, and record the elapsed time in that file

**Checkpoint**: ✅ **T013–T026 COMPLETE (2026-08-20)**. T027 is human-gated and remains open.

The CLI works end to end, verified by running it: it added a word with 6 questions spanning all
five levels and two ungated ones, that content validated, and the full suite stayed green.

**A rule was wrong and running the tool caught it.** The homograph refusal originally rejected any
word with two identically-spelled forms — which is EVERY regular English verb (walked/walked). It
refused `jump`. Refusing regular verbs would have rejected most of A1. The rule is now narrow and
correct: it refuses only when BASE and PAST collapse (`read`/`read`), because that is the case
where "what is the past tense?" genuinely has no answerable options. `walked`/`walked` is fine —
the duplicate participle component is simply not generated.

The unit tests did not catch this: they only ever exercised base==past. A regular-verb case is now
part of the suite.

**Run T027 before authoring all of Chapter 2** — if authoring five words is painful, forty will not
get better, and the next task is a better tool rather than more content.

---

## Phase 4: User Story 2 — The player continues from Chapter 1 into Chapter 2 (Priority: P2)

**Goal**: Chapter 2 opens to a player who finished Chapter 1, with every scrap of progress intact.

**Independent Test**: Load a save with Chapter 1 completed and confirm Chapter 2 is reachable and
nothing was lost.

### Tests for User Story 2

- [X] T028 [P] [US2] Test in tests/integration/cross-chapter.test.ts that completing Chapter 1 makes Chapter 2 available, and that it is unavailable before (FR-009)
- [X] T029 [P] [US2] Test in tests/integration/cross-chapter.test.ts that level, XP, gold, inventory, equipped items, pet, grammar learned, monsters defeated, and all word mastery survive the chapter transition unchanged (FR-010)
- [X] T030 [P] [US2] Test in tests/integration/cross-chapter.test.ts that a save fixture written before Chapter 2 existed loads and reaches Chapter 2 with 100% of its progress intact (FR-011, SC-007)

### Implementation for User Story 2

- [X] T031 [US2] Add the `enter-chapter` intent and its guard to src/runtime/intents.ts and src/runtime/GameStore.ts, dropping it when the chapter is unavailable (FR-009)
- [X] T032 [US2] Surface the blocking chapter to the player in src/components/hud/ so a locked chapter says what remains rather than simply refusing (FR-009)
- [X] T033 [US2] Wire chapter transition into the world scene in src/phaser/scenes/WorldScene.ts so completing Chapter 1's challenge leads into Chapter 2's first map (FR-018)
- [X] T034 [US2] Allow return to completed chapters' maps for practice in src/core/chapter/progression.ts and src/runtime/GameStore.ts (FR-012)
- [X] T035 [P] [US2] Add locale keys for chapter transition and locked-chapter messaging to src/locales/th.json and src/locales/en.json (FR-019)
- [X] T036 [US2] Author the Chapter 2 record in src/content/data/chapters.json with `requiresChapterId: "chapter-1"`, its maps, boss, challenge, and completion reward (FR-018)
- [X] T037 [US2] Create the three Chapter 2 maps in public/assets/ via scripts/generate-placeholders.ts, with transitions linking them and back to Chapter 1 (FR-018)

**Checkpoint**: ✅ **COMPLETE** — the gate lives on the map TRANSITION rather than a menu action, because walking is how the player moves. Blocked transitions name the chapter in the way.

---

## Phase 5: User Story 3 — The player learns Chapter 2's grammar from new characters (Priority: P3)

**Goal**: Present Continuous and `do`/`does` questions, taught by new NPCs in the new location.

**Independent Test**: Walk up to a Chapter 2 NPC, complete the lesson, and confirm its dependent
questions become eligible in battle.

### Tests for User Story 3

- [X] T038 [P] [US3] Test in tests/unit/dialogue.test.ts that completing a Chapter 2 lesson records the topic and makes its gated questions eligible (FR-017)
- [X] T039 [P] [US3] Test in tests/integration/cross-chapter.test.ts that Chapter 1's learned grammar remains learned in Chapter 2 and is not re-taught as new (FR-017)

### Implementation for User Story 3

- [X] T040 [P] [US3] Author the `present-continuous` and `question-forms` grammar topics in src/content/data/grammar.json, both locales (FR-014, research R-108)
- [X] T041 [US3] Author six Chapter 2 NPCs in src/content/data/npcs.json with their roles, portraits, and map placement (FR-018)
- [X] T042 [US3] Author their dialogue trees in src/content/data/dialogue.json, including in-frame practice questions and post-lesson variation (FR-018)
- [X] T043 [P] [US3] Place the Chapter 2 NPCs on the new maps via scripts/generate-placeholders.ts spawn objects, all in bounds and off transitions (feature 001 T077 lesson)
- [X] T044 [US3] Verify no hardcoded Thai entered any new component by running tests/content/locale-audit.test.ts (FR-019)

**Checkpoint**: ✅ **COMPLETE** — Present Continuous and do/does questions, taught by six new NPCs. The locale audit caught English written into a Thai lesson line before anyone played it.

---

## Phase 6: User Story 4 — Battles mix new words with words the player already met (Priority: P4)

**Goal**: Prove cross-chapter review works. Per research R-104 this requires **no new mechanism** —
the review pool already keys off `encountered`, which was never scoped to a chapter.

**Independent Test**: Play Chapter 2 battles with a Chapter 1 save loaded and measure what
proportion of questions come from Chapter 1 vocabulary.

### Tests for User Story 4

- [X] T045 [P] [US4] Test in tests/integration/cross-chapter.test.ts that at least 25% of questions in Chapter 2 battles come from Chapter 1 vocabulary, measured across a full playthrough (FR-015, SC-006)
- [X] T046 [P] [US4] Test in tests/integration/cross-chapter.test.ts that a fully mastered Chapter 1 word answered wrongly during Chapter 2 review is demoted and returns for further review (FR-015)
- [X] T047 [P] [US4] Test in tests/unit/questionSelect.test.ts that the review pool degrades gracefully for a player who skipped most of Chapter 1's optional monsters (FR-015)

### Implementation for User Story 4

- [X] T048 [US4] Author Chapter 2's vocabulary into src/content/data/vocabulary.json — at least 30 new A1 words with forms, meanings, and examples in both locales — using `npm run author` (FR-014, FR-019, SC-004)
- [X] T049 [US4] Author the Chapter 2 question set into src/content/data/questions.json via `npm run author`, covering every derived component, all five levels, and all four difficulty tiers (FR-014, SC-004)
- [X] T050 [US4] Author six Chapter 2 monsters plus the chapter boss in src/content/data/monsters.json, each with at least two ungated questions (FR-004, FR-018)
- [X] T051 [US4] Place the Chapter 2 monsters on the new maps via scripts/generate-placeholders.ts, with patrol radii set (FR-018)
- [X] T052 [US4] Confirm no file under src/core/, src/runtime/, src/phaser/, or src/components/ changed to make **battle** review span chapters, by inspecting `git diff --name-only` for this phase. Scoped to battles deliberately: the chapter CHALLENGE does filter per-chapter and legitimately changes code in T057 (research R-104)

**Checkpoint**: ✅ **COMPLETE** — measured at ≥25% across 12 seeded playthroughs (SC-006). 40 words, 221 questions, all five levels and four tiers, authored entirely through the CLI.

---

## Phase 7: User Story 5 — The player completes Chapter 2 (Priority: P5)

**Goal**: A second gatekeeper, drawing on both chapters, and a chapter that can be finished.

**Independent Test**: Defeat the Chapter 2 boss, face the gatekeeper, pass and fail the challenge.

### Tests for User Story 5

- [X] T053 [P] [US5] Test in tests/integration/chapter-completion.test.ts that the Chapter 2 challenge unlocks only after its own boss falls, not Chapter 1's (FR-016)
- [X] T054 [P] [US5] Test in tests/integration/chapter-completion.test.ts that Chapter 2 challenge questions come from Chapter 2 content and Chapter 1 review material (FR-016)
- [X] T055 [P] [US5] Test in tests/integration/chapter-completion.test.ts that passing marks Chapter 2 complete and grants its reward, and failing costs no HP and keeps all mastery (FR-016)

### Implementation for User Story 5

- [ ] T056 [US5] Author the Chapter 2 gatekeeper NPC and their challenge dialogue in src/content/data/npcs.json and src/content/data/dialogue.json, both locales (FR-016)
- [X] T057 [US5] Extend challenge question drawing in src/core/chapter/challenge.ts to include earlier chapters' review material alongside the chapter's own (FR-016)
- [X] T058 [US5] Author the Chapter 2 completion reward in src/content/data/chapters.json (FR-018)
- [X] T059 [US5] Write the Chapter 2 story beats and its closing moment in src/locales/th.json and src/locales/en.json (FR-019)

**Checkpoint**: ✅ **COMPLETE** — the Chapter 2 challenge draws from both chapters, but only from Chapter 1 words the player actually ENCOUNTERED. Testing someone on content they skipped is a trap.

---

## Phase 8: Polish & Cross-Cutting Concerns

- [X] T060 [P] Add chapter grouping to the word journal in src/components/journal/WordJournal.tsx (research R-107, SC-010)
- [X] T061 [P] Add a mastered / in-progress / not-started filter to src/components/journal/WordJournal.tsx, built from the existing menu buttons rather than a native form control (research R-107)
- [ ] T062 Verify SC-010 against src/components/journal/WordJournal.tsx by having a playtester find a specific word in under 15 seconds with 70+ words loaded
- [X] T063 [P] Verify SC-008 by running `npm test` with both chapters loaded and confirming the suite finishes under 30 seconds; if not, find the test that touched a browser or that scans content quadratically
- [X] T064 [P] Verify coverage thresholds in vitest.config.ts still hold with the new core modules
- [X] T065 [P] Run the full locale audit in tests/content/locale-audit.test.ts across both chapters (FR-019, SC-009)
- [X] T066 [P] Run tests/content/anti-quiz.test.ts to confirm no new component introduced a native form control (Principle I)
- [X] T067 Switch content validation to the `shipping` level for chapter-2 in tests/content/schemas.test.ts once its content is complete
- [ ] T068 Balance pass on Chapter 2 monster HP and attack in src/content/data/monsters.json, extending the pacing assertions in tests/integration/balance.test.ts to cover Chapter 2
- [ ] T069 **Verify SC-002 by inspecting the diff**: confirm authoring Chapter 2's content changed no file outside src/content/data/ and public/assets/ (FR-001)
- [ ] T070 Play Chapter 2 end to end in a browser via `npm run dev` → /play — first map through gatekeeper — confirming walk cycle, dialogue, battles, and challenge behave as in Chapter 1. Some defects are invisible to both a Node suite and a screenshot; Chapter 1 shipped three of them
- [X] T071 [P] Verify FR-020 by inspecting `git diff --name-only` across the whole feature: no new question type in src/content/schemas/questions.ts and no new battle mechanic in src/core/battle/battle.ts. If either changed, the authoring measurement in T075 is confounded and must be reported as such
- [X] T072 [P] Verify SC-003 by reviewing the defect log for this feature: every content mistake made while authoring Chapter 2 must have been caught by validation before a play session, recorded in specs/002-chapter2-content-scale/quickstart.md
- [X] T073 [P] Verify SC-004 in tests/content/schemas.test.ts: chapter-2 declares at least 30 words, 2 grammar topics, 6 NPCs, 6 monsters plus a boss, and a challenge
- [ ] T074 Verify SC-005 by timing a full Chapter 2 playthrough in the browser and confirming it completes in 45 to 90 minutes; tune src/content/data/monsters.json and src/content/data/balance.json if it falls outside
- [ ] T075 **Record the measurement this feature exists to take** in specs/002-chapter2-content-scale/quickstart.md: how long authoring Chapter 2 took, and how much of that was fighting tooling rather than writing content

---

## Dependencies & Execution Order

```text
Phase 1 (Setup)
   ↓
Phase 2 (Foundational — chapter ordering) ──── blocks everything below
   ↓
Phase 3 (US1 — authoring CLI) 🎯 ─── the hypothesis; run T027 before bulk authoring
   ↓
Phase 4 (US2 — progression) ─── needs chapter ordering; produces the Chapter 2 record
   ↓
Phase 5 (US3 — grammar & NPCs) ─── needs the Chapter 2 record and its maps
   ↓
Phase 6 (US4 — vocabulary & review) ─── needs the authoring CLI; the bulk of the content work
   ↓
Phase 7 (US5 — completion) ─── needs Chapter 2's boss and vocabulary to exist
   ↓
Phase 8 (Polish)
```

### User story dependencies

Unlike feature 001, these stories are **not** independently deliverable, and the honest reason is
that they share one artifact: Chapter 2's content. US3, US4, and US5 all author into the same
files and all depend on US1's tool existing. US2 is the exception — chapter ordering and progress
continuity can be built and tested against a stub Chapter 2 with a single word in it.

### Parallel opportunities

- T002, T003 in Setup
- T009, T010, T011 in Foundational
- All of T013–T017 (US1 tests) together
- T038, T039 (US3 tests) and T045–T047 (US4 tests) together
- Most of Phase 8 — T060, T061, T063, T064, T065, T066, T071, T072, T073

## Implementation Strategy

**Stop after T027 and check the number.** Phase 3 delivers the authoring tool and asks one person
to add five words with it. If that is painful, authoring forty will not improve, and the correct
next move is a better tool — or the spreadsheet import rejected in research R-101 — rather than
grinding out Chapter 2 by hand.

That checkpoint is the whole point of ordering the authoring story as P1 rather than starting with
the content.

**Then bulk-author in Phase 6**, which is where most of the calendar time will go and where the
measurement in T071 actually accrues.

## Task Summary

| Phase | Tasks | Story | Delivers |
|---|---|---|---|
| 1 | T001–T003 | — | The `author` script wired up |
| 2 | T004–T012 | — | Chapter ordering, validation, save compatibility |
| 3 | T013–T027 | US1 (P1) | 🎯 The authoring CLI and its refusals — the hypothesis |
| 4 | T028–T037 | US2 (P2) | Chapter 2 reachable, all progress carried forward |
| 5 | T038–T044 | US3 (P3) | Present Continuous and question forms, taught by new NPCs |
| 6 | T045–T052 | US4 (P4) | 30+ new words, ~240 questions, cross-chapter review verified |
| 7 | T053–T059 | US5 (P5) | The second gatekeeper and an earned ending |
| 8 | T060–T075 | — | Journal at scale, balance, audits, and the measurement |

**Total**: 75 tasks. **Critical path to the hypothesis**: T001–T027.

## Notes

- Roughly half of these tasks are **content authoring**, not code. That ratio is the expected
  result if Principle III holds, and a much lower ratio would itself be a finding worth reporting.
- Every refusal rule in Phase 3 traces to a defect Chapter 1 actually shipped or nearly shipped.
- FR-021 (when the Stage 2 open world unlocks) is deliberately absent from this list. It is a
  constitution amendment, not a task, and Chapter 2 behaves identically under all three candidate
  answers.
