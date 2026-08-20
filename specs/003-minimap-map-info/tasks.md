---
description: "Task list for Minimap and Map Information"
---

# Tasks: Minimap and Map Information

**Input**: Design documents from `/specs/003-minimap-map-info/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Tests**: Included, but for a different reason than in features 001 and 002. Constitution
Principle V mandates tests for rules that change player state, and **this feature changes none**
(FR-016) — so it is satisfied by absence rather than by coverage. Tests are here because the
derivation is a pure function with real edge cases (empty maps, non-square maps, stale state on
map change), and pure functions with edge cases are cheap to test and expensive to debug by hand.

The React components are rendering and remain exempt. They are verified in a browser, which is
where this project has found every layout defect it has ever shipped.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on an incomplete task
- **[Story]**: US1–US3. Setup, Foundational, and Polish carry no story label.

## Path Conventions

Unchanged from features 001 and 002: `src/core/`, `src/content/`, `src/components/`, `src/locales/`,
`tests/` at repository root.

---

## Phase 1: Setup

**Purpose**: Almost nothing. This feature adds no dependency, no layer, and no configuration.

- [X] T001 Create the empty derivation module at src/core/world/minimap.ts with its exported function signatures from contracts/minimap-model.md
- [X] T002 [P] Create the empty test suite at tests/unit/minimap.test.ts so the harness picks it up

**Checkpoint**: `npm test` still green; the new module compiles.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Map names in content. Every story below displays or depends on them, and they are the
only new authored data this feature introduces.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

- [X] T003 Add the `mapNames` record to the chapter schema in src/content/schemas/chapters.ts, keyed by map id with a localized value (data-model §1, FR-015)
- [X] T004 Author Thai and English names for all six existing maps in src/content/data/chapters.json — village, forest, cave, castle, river, ruins (FR-013, FR-018)
- [X] T005 Add cross-file validation to src/core/content/validate.ts requiring every id in `mapIds` to have a `mapNames` entry with both locales non-empty, naming the file and the map on failure (FR-015)
- [X] T006 [P] Test the map-name validation in tests/content/schemas.test.ts: a map with no name fails, and a name with an empty Thai side fails
- [X] T007 [P] Implement `mapDisplayName` in src/core/world/minimap.ts, returning the authored name and never an empty string or a raw id (FR-014)
- [X] T008 [P] Test `mapDisplayName` in tests/unit/minimap.test.ts, including the fallback path for a map with no authored name (FR-014)

**Checkpoint**: Every map has a localized name, and content fails to load without one.

---

## Phase 3: User Story 1 — See where I am and where the exits are (Priority: P1) 🎯 MVP

**Goal**: A small map in the corner showing the area's shape, the player's position on it, and
where its exits are.

**Independent Test**: Load any map via `/play?map=<id>`, look at the minimap, walk three tiles, and
confirm the marker moves three steps.

### Tests for User Story 1

- [X] T009 [P] [US1] Test `buildMinimapTerrain` in tests/unit/minimap.test.ts: `blocked` is row-major with length width × height, and matches `GameMap.collidesAt` for every tile (FR-001)
- [X] T010 [P] [US1] Test in tests/unit/minimap.test.ts that every map transition appears in `exits` with its correct tile position (FR-003)
- [X] T011 [P] [US1] Test in tests/unit/minimap.test.ts that terrain is derived per map, so two different maps never produce equal models — the stale-map failure mode (FR-004)
- [X] T012 [P] [US1] Test in tests/unit/minimap.test.ts that a map with no monsters and no NPCs still produces a valid model with empty arrays rather than null (FR-007)

### Implementation for User Story 1

- [X] T013 [US1] Implement `buildMinimapTerrain` in src/core/world/minimap.ts per contracts/minimap-model.md (FR-001, FR-003, FR-004, FR-007)
- [X] T014 [US1] Implement `buildMinimapMarkers` in src/core/world/minimap.ts, returning the player's position and facing (FR-002)
- [X] T015 [US1] Build src/components/hud/Minimap.tsx as inline SVG sized from the map's own width and height, so proportions hold rather than stretching to a fixed box (FR-005, research R-305)
- [X] T016 [US1] Render Minimap from src/components/GameClient.tsx only while the screen is `world`, following the pattern WorldHud already uses (FR-006, research R-304)

**Checkpoint**: The player can orient themselves on every map. **This is the MVP** — everything
below adds detail to a picture that is already useful.

---

## Phase 4: User Story 2 — See what is left to do here (Priority: P2)

**Goal**: Markers for monsters not yet restored and NPCs whose lesson is unfinished, plus counts.

**Independent Test**: Load a map with both, confirm they are distinguishable, defeat a monster, and
confirm its marker is gone.

### Tests for User Story 2

- [X] T017 [P] [US2] Test in tests/unit/minimap.test.ts that markers include every monster in world state and that a defeated monster is absent — `enterMap` has already filtered it, so no second filter is needed (FR-008, FR-009)
- [X] T018 [P] [US2] Test in tests/unit/minimap.test.ts that a monster's marker position follows it after `stepPatrol` (FR-010)
- [X] T019 [P] [US2] Test in tests/unit/minimap.test.ts that `lesson` is `"none"` for an NPC with no `grammarTopicId`, `"outstanding"` for one with an unlearned topic, and `"done"` for one with a learned topic — never omitted (FR-011)
- [X] T020 [P] [US2] Test in tests/unit/minimap.test.ts that `monstersRemaining` and `lessonsRemaining` match the map's actual outstanding work, that `lessonsRemaining` excludes NPCs with `lesson: "none"`, and both counts are zero on a finished map (FR-012)

### Implementation for User Story 2

- [X] T021 [US2] Extend `buildMinimapMarkers` in src/core/world/minimap.ts with monster and NPC markers (NPC `lesson` as `"none" | "outstanding" | "done"`, derived from `grammarTopicId` and `hasCompletedLesson` from src/core/dialogue/dialogue.ts rather than reimplemented) and the two remaining-counts, excluding `"none"` from `lessonsRemaining` (FR-008, FR-011, FR-012)
- [X] T022 [US2] Render monster, NPC, and player markers distinguishably in src/components/hud/Minimap.tsx — by shape as well as colour, since colour is the first thing to fail on a small pixel-art palette. NPCs with `lesson: "none"` render in a neutral style, distinct from both `"outstanding"` and `"done"` (FR-008, FR-011)

**Checkpoint**: The minimap answers "what have I not done here?" without walking the map.

---

## Phase 5: User Story 3 — Know which place this is (Priority: P3)

**Goal**: The map's name and its chapter's title, in the player's language.

**Independent Test**: Load a map, read the name, switch language, confirm it changes.

### Tests for User Story 3

- [X] T023 [P] [US3] Test in tests/content/locale-audit.test.ts that every authored map name carries Thai script on its Thai side and non-empty text on its English side (FR-018, SC-007)

### Implementation for User Story 3

- [X] T024 [US3] Build src/components/hud/MapInfo.tsx showing the map name, the chapter title, and the two remaining-counts as DOM text beside the SVG — never inside it, so Thai marks render through the DOM (FR-013, FR-012, research R-014 of feature 001)
- [X] T025 [P] [US3] Add locale keys for the remaining-counts labels to src/locales/th.json and src/locales/en.json (FR-018)
- [X] T026 [US3] Render MapInfo alongside Minimap from src/components/GameClient.tsx, hidden outside the world screen (FR-006)

**Checkpoint**: The player knows where they are, in their own language.

---

## Phase 6: Polish & Cross-Cutting Concerns

- [X] T027 Memoize terrain on map identity in src/components/hud/Minimap.tsx so a monster patrolling every 900ms does not recompute 300 collision lookups for a picture that has not changed (plan.md § Performance Goals)
- [X] T028 [P] Verify SC-004 in tests/unit/save.test.ts: a save round-trip is byte-identical before and after this feature, because it adds no persisted state (FR-016)
- [X] T029 [P] Verify SC-005 by running `npm test` and confirming the suite still finishes under 30 seconds
- [X] T030 [P] Verify SC-007 by running `npm run author:check` and tests/content/locale-audit.test.ts across both chapters
- [X] T031 Verify SC-006 against src/components/hud/Minimap.tsx via `npm run dev` at 390px, 820px, and 1280px: the minimap must never overlap the question panel, the dialogue box, or the challenge panel. Check it visually rather than by reading app/globals.css — feature 001 shipped a layout defect where the feedback panel pushed the HP bar over the monster, and the suite was green throughout
- [X] T032 Verify SC-003 in a browser by loading all six maps via `/play?map=<id>` and confirming each renders correctly, including a map with no entities on it
- [X] T033 Verify SC-002 via `npm run dev` → /play by walking every walkable tile of one map and confirming the marker in src/components/hud/Minimap.tsx never disagrees with the player's true position
- [ ] T034 Verify SC-001 via `npm run dev` by having a playtester return to a map after a break and state what they still have to do there within 5 seconds, without walking
- [X] T035 [P] Verify FR-017 by inspecting `git diff --name-only` across the whole feature: src/content/schemas/questions.ts and src/core/battle/battle.ts must be untouched. A navigation aid that changed a battle rule would be a different feature
- [X] T036 Verify SC-008 by adding a seventh map name to src/content/data/chapters.json and confirming via `git diff --name-only` that no file outside src/content/data/ changed — the same check SC-008 of feature 001 and SC-002 of feature 002 used

---

## Dependencies & Execution Order

```text
Phase 1 (Setup)
   ↓
Phase 2 (Foundational — map names) ──── blocks everything below
   ↓
Phase 3 (US1 — orientation) 🎯 ─── the MVP; useful on its own
   ↓
Phase 4 (US2 — what remains) ─── extends the marker builder US1 created
   ↓
Phase 5 (US3 — map information) ─── displays the counts US2 derives
   ↓
Phase 6 (Polish)
```

### User story dependencies

US1 is genuinely independent and shippable alone — a minimap showing terrain, the player, and exits
is useful with no markers at all.

US2 and US3 are **not** independent of US1, and the reason is honest rather than structural: they
extend the same `buildMinimapMarkers` function and render into the same component. Splitting them
into separately shippable slices would mean building the component twice.

### Parallel opportunities

- T006, T007, T008 in Foundational
- All of T009–T012 (US1 tests) together
- All of T017–T020 (US2 tests) together
- T028, T029, T030, T035 in Polish

## Implementation Strategy

**Ship US1 first and look at it.** A minimap showing terrain, position, and exits is the whole
orientation win; markers and names are refinement. If the shape of it is wrong — too small, too
faint, in the way — that is far cheaper to discover before two more phases render into it.

The browser checks in Phase 6 are not ceremony. Every layout and animation defect this project has
shipped was invisible to the test suite and obvious on screen within seconds.

## Task Summary

| Phase | Tasks | Story | Delivers |
|---|---|---|---|
| 1 | T001–T002 | — | Module and test suite skeletons |
| 2 | T003–T008 | — | Localized map names, validated |
| 3 | T009–T016 | US1 (P1) | 🎯 Terrain, player position, exits |
| 4 | T017–T022 | US2 (P2) | Monster and NPC markers, remaining counts |
| 5 | T023–T026 | US3 (P3) | Map name and chapter title |
| 6 | T027–T036 | — | Memoization, audits, browser verification |

**Total**: 36 tasks. **Critical path to a useful minimap**: T001–T016.

## Notes

- This feature adds **no persisted state, no mechanic, and no dependency**. If it turns out to be
  one pure function and some CSS, that is the correct outcome — the map model was already put in
  core and framework-free by features 001 and 002, and this is the first feature to collect on it.
- Only T034 needs a person. Every other task is completable by engineering, which is a change from
  001 and 002, where the blocking work was human-gated.
