---
description: "Task list for Chapter 1 Vertical Slice"
---

# Tasks: Chapter 1 Vertical Slice

**Input**: Design documents from `/specs/001-chapter1-vertical-slice/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md), [data-model.md](./data-model.md), [contracts/](./contracts/)

**Stack**: Next.js 16 (App Router) + React 19 + Phaser 3.90. React renders text, Phaser renders the
world. **Socket.IO and the Stage 2 open world appear nowhere below** — that is deliberate and
enforced by Constitution v1.1.0 § Product Shape.

**Tests**: Test tasks are **mandatory**, not optional. Constitution Principle V requires automated
tests for every rule that changes HP, XP, gold, mastery, inventory, chapter status, or save data. Each
core module's tests ship in the same task as the module. React components and Phaser scenes are
exempt as rendering.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel — different files, no dependency on another incomplete task
- **[Story]**: The user story served (US1–US7), or `SETUP` / `FOUND` / `POLISH`

## Path Conventions

`app/`, `src/core/`, `src/runtime/`, `src/phaser/`, `src/components/`, `src/content/`, `src/locales/`,
`src/platform/`, `public/assets/`, `tests/`, `scripts/` — all at repository root, per plan.md.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: A Next.js repository that builds, type-checks, lints, and tests. Nothing game-specific.

- [x] **T001** [SETUP] Scaffold the Next.js 16 App Router application at repository root with
      TypeScript. `app/layout.tsx`, `app/page.tsx` (landing), `app/globals.css`. No `src/app` — routes
      live in `app/`, game code in `src/`.
- [x] **T002** [SETUP] Install pinned dependencies: `next@16`, `react@19`, `react-dom@19`,
      `phaser@3.90.0`, `zod@^4.4.3`. Dev: `vitest@^4`, `typescript@5.9.3`, `eslint@^10`,
      `typescript-eslint`, `@types/node`, `@types/react`. **Do not install `socket.io` or
      `socket.io-client`** — Stage 2 (R-017). Pin Phaser and TypeScript per R-001 and R-002 rather
      than taking `latest`.
- [x] **T003** [SETUP] Configure `tsconfig.json`: `strict: true`, `noUncheckedIndexedAccess: true`,
      Next plugin, path aliases `@/core/*`, `@/runtime/*`, `@/phaser/*`, `@/components/*`,
      `@/content/*`.
- [x] **T004** [P] [SETUP] Configure `next.config.ts`: static asset handling for `public/assets/`, and
      dev-only exposure of the `/play` query-parameter shortcuts so they are inert in production.
- [x] **T005** [P] [SETUP] Configure `vitest.config.ts`: **Node environment** — no jsdom, no
      happy-dom. Include `tests/**` only. Coverage reporter scoped to `src/core/**`.
- [x] **T006** [SETUP] Configure `eslint.config.js` with **all four layering rules** (R-011). This is
      the enforcement mechanism for Constitution Principle II and is not deferrable:
      `src/core/**` and `src/content/**` may not import `phaser`, `react`, `next`, `../runtime/*`, or
      use DOM globals (`window`, `document`, `localStorage`), and may not call `Math.random`;
      `src/runtime/**` may not import `phaser` or `react` components;
      `src/components/**` may not import `phaser`;
      `src/phaser/**` may not import `react` or anything under `src/components/`.
- [x] **T007** [P] [SETUP] Add a lint rule banning `socket.io`, `socket.io-client`, and `ws` imports
      repository-wide. Stage 2 must not leak into Stage 1 by convenience, and a rule is cheaper than
      remembering (Constitution § Product Shape).
- [x] **T008** [P] [SETUP] Create the directory skeleton from plan.md with a `.gitkeep` in each empty
      directory. No stub files, no empty interfaces — Principle VI.
- [x] **T009** [P] [SETUP] Add `.gitignore` (`node_modules`, `.next`, `public/assets/placeholder`,
      `.DS_Store`) and `.editorconfig`.
- [x] **T010** [SETUP] Configure fonts in `app/layout.tsx` via `next/font` per R-016: a display face
      and a **Thai-capable** text face. Verify the Thai face stacks a tone mark over an upper vowel
      correctly — test with a word that stacks, not with plain Thai text.
- [x] **T011** [SETUP] Add a smoke test in `tests/unit/smoke.test.ts` and prove `npm test`,
      `npm run typecheck`, `npm run lint`, and `npm run build` all execute end to end.

**Checkpoint**: ✅ **COMPLETE (2026-08-20)** — `npm install && npm test && npm run lint &&
npm run typecheck && npm run build` all succeed, and `/` renders.

Boundary rules were verified by writing deliberate violations into each layer and confirming ESLint
rejected all eight: `core → phaser`, `core → react`, `core → Math.random`, `core → window`,
`runtime → phaser`, `components → phaser`, `phaser → react`, and `core → socket.io-client`. A lint
rule that has never been shown to fail is not enforcement.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared spine — content loading and validation, balance, localization, deterministic
randomness, player state, mastery, and the runtime bridge.

**⚠️ CRITICAL**: No user story work begins until this phase is complete.

### Content schemas and loading

- [x] **T012** [FOUND] Write Zod schemas in `src/content/schemas/` for every entity in
      [data-model.md](./data-model.md): `VocabularyWord`, `WordForm`, `Example`, `GrammarTopic`,
      `Question` (with its word, component, difficulty tier, and grammar dependency per FR-017),
      `Monster`, `RewardTable`, `NPC`, `DialogueNode`, `Item`, `Effect`, `Chapter`, `BalanceConfig`.
      Export types via `z.infer` — no hand-written duplicates of a schema's shape.
- [x] **T013** [FOUND] Encode the localization type rule in the schemas: `Localized = { th, en }` for
      instructional text; plain `string` for target-language fields (`word`, `WordForm.text`,
      `Question.options`, `Example.sentence`, `GrammarTopic.patterns`). Test that a `Localized` object
      in a target-language position fails validation (FR-052).
- [x] **T014** [FOUND] Support question levels 1–5 (FR-015) and reject `level: 6` in `QuestionSchema`
      at the type level (FR-016). Test that a level-6 question fails validation.
- [x] **T015** [FOUND] Implement `src/core/content/deriveComponents.ts`: a word's mastery components
      are `meaning` + one `form:<id>` per declared form + `context` (FR-023). Tests: a multi-form word,
      and a single-form word that must still produce a valid masterable component set.
- [x] **T016** [FOUND] Implement `src/core/content/validate.ts` — the cross-file pass in
      [contracts/content-schemas.md](./contracts/content-schemas.md): referential integrity,
      uniqueness, answer soundness (FR-022), localization completeness, chapter completeness.
      **Collect all errors**, never fail on the first.
- [x] **T017** [FOUND] Implement `ContentValidationError` with `{ file, path, message }` and the
      `file.json → path: message` rendering (FR-050). Test a nested path such as
      `questions[42].options[2]`.
- [x] **T018** [FOUND] Implement `src/core/content/loadContent.ts` returning a `ContentIndex` with the
      lookups in [contracts/core-api.md](./contracts/core-api.md). All content is data, never
      hardcoded in gameplay logic (FR-049). Tests: valid content indexes correctly; invalid content
      throws with every error listed.

### Config, i18n, randomness

- [x] **T019** [P] [FOUND] Implement `src/core/config/balance.ts` — typed access to `BalanceConfig`.
      Test that every field in the defaults table in data-model.md is present and typed.
- [x] **T020** [P] [FOUND] Implement `src/core/i18n/` with `t(key, params)`, `setLocale`, and the
      `⟪missing:key⟫` development marker (FR-051). Tests: resolution, interpolation, missing key,
      locale switch.
- [x] **T021** [P] [FOUND] Implement `src/core/rng/` — the `Rng` interface and `createRng(seed)` using
      a deterministic PRNG (mulberry32 or xorshift128). Tests: same seed yields the same sequence;
      `int()` stays in range; `pick()` covers all elements over many draws (R-007).
- [x] **T022** [FOUND] Create `src/locales/th.json` and `en.json` with the UI keys needed so far, plus
      `tests/content/locale-parity.test.ts` asserting identical key sets in both files (SC-009).

### Player state and mastery

- [x] **T023** [FOUND] Implement `src/core/player/playerState.ts`: the `PlayerState` shape from
      data-model.md, `createNewPlayer(balance)`, and HP clamping (FR-009). Tests: new player defaults;
      clamping at 0 and at max; never negative, never over max.
- [x] **T024** [FOUND] Implement `src/core/mastery/mastery.ts`: `initMastery`, `recordAnswer`,
      `masteryPercent`, `isWordMastered`, `wordsMasteredCount` — promotion and demotion per R-005 and
      FR-024/025/026.
- [x] **T025** [FOUND] Test mastery exhaustively — this is the pedagogical core and Principle IV lives
      or dies here:
      one correct answer does **not** master (FR-024);
      two consecutive correct **do** master;
      a wrong answer on an unmastered component resets the streak to 0;
      a wrong answer on a mastered component demotes to `streakRequired - 1`, not to 0 (FR-025);
      one correct review answer restores a demoted component;
      `masteryPercent` is exact at 0%, at a partial value, and at exactly 100%;
      a word is MASTERED only when every component is;
      a single-form word can reach 100%;
      `streakRequired` is read from balance, not hardcoded.
- [x] **T026** [FOUND] Implement `src/core/save/SaveRepository.ts` — the interface and
      `SaveLoadResult` union only (FR-053, contracts/save-format.md). No implementation yet; US7
      supplies it.

### Runtime bridge

- [x] **T027** [FOUND] Implement `src/runtime/GameStore.ts` per
      [contracts/runtime-bridge.md](./contracts/runtime-bridge.md): `getSnapshot`, `subscribe`,
      `dispatch`, with a stable snapshot reference that changes identity only when state changes.
      **The store contains no rules** — it forwards to `src/core/` and stores what comes back.
- [x] **T028** [FOUND] Implement `src/runtime/intents.ts` — the closed `Intent` union from the bridge
      contract, and intent-level input dropping: an `answer-question` arriving while
      `battle.phase !== "awaiting-answer"` is **discarded, not queued** (FR-010).
- [x] **T029** [FOUND] Test the store: subscribers fire on change and not otherwise; snapshot identity
      is stable across no-op reads; unsubscribe stops delivery; intents dispatched in the wrong phase
      are dropped; **no rule is computed in the store** (asserted by the layering lint rule plus a
      review check).
- [x] **T030** [P] [FOUND] Implement `src/runtime/useGameState.ts` — the React binding over
      `useSyncExternalStore`, with a selector so a battle HP change does not re-render the journal.

### Seed content and placeholder assets

- [x] **T031** [FOUND] Author a **minimal** content slice sufficient for US1, all as data files
      (FR-049): `balance.json` with the defaults from data-model.md, 5 vocabulary words including `go`
      with all four forms, ~20 questions covering levels 1–5 and every component of `go`, and one
      non-boss monster plus the `go` boss. Full chapter content comes at T117 — do not author 30 words
      now.
- [x] **T032** [FOUND] Write `scripts/generate-placeholders.ts` producing every asset in
      [contracts/asset-contract.md](./contracts/asset-contract.md) into `public/assets/placeholder/` at
      exact dimensions and frame order — characters, monsters, portraits, tilesets, stars — plus three
      `.tmj` maps with all six named layers and valid spawn and transition objects. **No UI chrome
      art**: dialogue frames, buttons, panels, and bars are CSS now. Then add
      `tests/content/asset-contract.test.ts` asserting every required path exists at the contracted
      dimensions, and `tests/content/schemas.test.ts` validating every shipped content file.

**Checkpoint**: ✅ **COMPLETE (2026-08-20)** — 103 tests pass in ~0.3s (SC-007 budget is 30s),
lint and typecheck clean, `npm run build` succeeds. Content loads and validates, mastery is proven
correct by 18 tests, randomness is deterministic, both locales are in parity, the store drops
disallowed intents, and 17 placeholder assets generate and pass the asset contract.

Carried into Phase 3, deliberately rather than by omission:
- **T028** — the intent guard *mechanism* is built and tested; the battle-phase guard lands with
  `BattleState` in T039. `GameState` likewise gains its `battle` slot there. Inventing those shapes
  now would be the placeholder architecture Principle VI rejects.
- **T027** — `GameStoreDeps` gains `content: ContentIndex` in T039, when starting a battle first
  needs it. Carrying an unused dependency now is dead weight.

---

## Phase 3: User Story 1 — Turn-based question battle (Priority: P1) 🎯 MVP

**Goal**: A complete, playable turn-based battle where a correct answer attacks and a wrong answer
lets the monster attack. This is the hypothesis under test.

**Independent Test**: `/play?battle=go-monster` opens a battle with no map, no NPC, no save.

### Core rules (no rendering)

- [x] **T033** [US1] Implement `src/core/questions/select.ts` — the weighted selection from R-004:
      eligibility filter (monster word or encountered review word; grammar learned; not the previous
      question), then weighting by source, component mastery state, and recency. All weights from
      balance config.
- [x] **T034** [US1] Test question selection: prefers unmastered components of the monster's word
      (FR-019); excludes questions whose grammar is unlearned (FR-018); never repeats consecutively
      (FR-013); prefers unasked questions until the pool is exhausted; degrades gracefully when the
      pool is smaller than the battle is long; falls back to the monster's word when the review pool
      is empty; **throws a named error rather than returning undefined** when nothing is eligible.
- [x] **T035** [P] [US1] Implement `src/core/questions/present.ts` — `presentQuestion` shuffling
      options via the injected `Rng` and returning `PresentedQuestion` with the remapped correct index
      (FR-021), plus `gradeAnswer`.
- [x] **T036** [P] [US1] Test presentation and grading: shuffled order varies across seeds; the
      correct answer always survives shuffling; the remapped index always points at it; grading is
      right for every option position; renderers can never see the authored ordering.
- [x] **T037** [P] [US1] Implement `src/core/questions/damage.ts` — `damageFor(question, weapon,
      balance)` per FR-005 and R-006: difficulty tier value × weapon multiplier, no weapon meaning ×1.
- [x] **T038** [P] [US1] Test damage: each of the four tiers yields its configured value; a weapon
      multiplier applies; damage comes from the tier and **not** from the question's level; editing
      `balance.json` changes damage with no code edit.
- [x] **T039** [US1] Implement `src/core/battle/battle.ts`: `createBattle`, `submitAnswer`,
      `attemptFlee`, `endBattle` per [contracts/core-api.md](./contracts/core-api.md). State is
      returned, never mutated in place. Exactly one question resolves per turn and grants at most one
      attack opportunity (FR-001). One side acts per turn. Victory and defeat decided here.
- [x] **T040** [US1] Test the battle turn rules — the heart of Principle V:
      correct answer damages the monster and the monster does **not** attack that turn (FR-002);
      wrong answer damages the player and the monster takes **no** damage that turn (FR-003);
      wrong answer returns feedback with the correct option and explanation, present in the result
      before the counterattack is reflected in state (FR-004);
      monster damage is reduced by armor and **floors at 0** (FR-006);
      HP floors at 0 and never goes negative (FR-009);
      monster HP hitting **exactly** 0 is a victory, player HP hitting **exactly** 0 is a defeat
      (FR-008);
      the battle continues while both are above 0 (FR-007);
      both cannot reach 0 on the same turn, because only one side acts;
      `submitAnswer` throws when `phase !== "awaiting-answer"` (FR-010);
      no further question is drawn after an outcome is decided.
- [x] **T041** [US1] Test flee: succeeds and fails against a seeded RNG at the configured chance;
      failure consumes the turn; success awards no rewards (FR-011); `attemptFlee` **throws** on a boss
      battle rather than returning a failure (FR-012); mastery earned before fleeing is retained.
- [x] **T042** [US1] Wire mastery into battle resolution: every answer calls `recordAnswer` for the
      question's component and the result carries `masteryEvents`. Test that mastery is applied per
      answer, not at battle end, so quitting mid-battle keeps it.
- [x] **T043** [US1] Integration test `tests/integration/battle-flow.test.ts`: a scripted all-correct
      run always wins without taking damage, and a scripted all-wrong run always ends in defeat
      (SC-005). Both against a fixed seed.

### Mounting the game

- [x] **T044** [US1] Implement `app/play/page.tsx` and `src/components/GameCanvas.tsx` — the client
      component that mounts Phaser via `next/dynamic` with `ssr: false` (R-013). **Guard against React
      Strict Mode's double effect invocation** with a ref, and destroy the Phaser instance on unmount.
      This is the classic way this integration breaks.
- [x] **T045** [US1] Implement `src/phaser/game.ts` plus `BootScene` and `PreloadScene`: Phaser config
      with `pixelArt: true`, asset preloading per the asset contract, and store subscription wired in
      `create()` with **unsubscribe on `shutdown`** (bridge contract).
- [x] **T046** [US1] Wire the dev query-parameter shortcuts (`?battle=`, `?map=`, `?challenge=`,
      `?locale=`, `?seed=`), active in development and inert in production.

### React battle UI

- [x] **T047** [US1] Establish the RPG visual language in `app/globals.css` and a shared panel
      component: pixel-stepped borders, the game palette, no default form controls, no system fonts.
      **This task exists because HTML defaults make things look like a web form, and a web form is
      exactly what Principle I forbids this game from becoming.**
- [x] **T048** [P] [US1] Build `src/components/battle/HpBar.tsx` — framed bar with a tweened fill,
      used for both combatants, in CSS rather than art.
- [x] **T049** [P] [US1] Build `src/components/battle/QuestionPanel.tsx` and `OptionList.tsx` — the
      prompt and four options, keyboard- and pointer-navigable, rendering `PresentedQuestion` so the
      authored ordering is never exposed.
- [x] **T050** [US1] Build `src/components/battle/FeedbackPanel.tsx` — the correct answer and its
      localized explanation, requiring dismissal before the counterattack resolves (FR-004). A
      Principle IV requirement, not a nicety.
- [x] **T051** [US1] Build `src/components/battle/BattleHud.tsx` composing the above over the canvas,
      reading state through `useGameState` and sending intents through `useDispatch`. It computes no
      damage and compares no HP to zero.
- [x] **T052** [US1] Implement input locking in the UI: options are visibly disabled while `phase` is
      not `awaiting-answer`, and inputs are **discarded, not queued** (FR-010). The store drops them
      too — belt and braces, because a queued answer resolving after a battle ends is a real bug.

### Phaser battle scene

- [x] **T053** [US1] Implement `src/phaser/scenes/BattleScene.ts`: monster sprite, backdrop, and the
      attack / hurt / damage-flash animations driven by store state. **No text** — React owns text
      (R-014).
- [x] **T054** [US1] Implement the victory sequence as **restoration**: the monster's frame-3 restored
      sprite, calm framing, copy that says the word was freed rather than killed (Principle I). Add
      the defeat sequence.

**Checkpoint**: ✅ **COMPLETE (2026-08-20)** — 176 tests pass in ~0.4s, lint/typecheck/build clean,
and the battle was driven end to end in a real browser at `/play?battle=monster-go&seed=42`:

```
initial                     monster 140/140   player 100/100
correct answer          →   monster 130/140   player 100/100   (FR-002: monster does not act)
wrong answer            →   feedback shows "go" + Thai explanation, player STILL 100/100
dismiss feedback        →   player 82/100                      (FR-004: taught before hit)
flee button on boss     →   absent                             (FR-012)
real asset 404 → placeholder served                            (asset contract fallback)
```

Two defects the test suite could never have caught, both found by looking at the screenshot:
- `:root { --font-text: var(--font-text) }` is self-referential, because `:root` IS the `<html>`
  element `next/font` puts its variable on. Every face silently fell back to a system serif.
- The battle overlay had no `min-height: 0` on its flexible row, so the feedback panel pushed the
  player HP bar up over the monster sprite.

**The core hypothesis is now testable — get this in front of a playtester before building Phase 4.**

---

## Phase 4: User Story 2 — Explore the world (Priority: P2)

**Goal**: Walk a village, forest, and cave; collide with obstacles; transition between maps; meet
visible monsters and choose to fight them.

**Independent Test**: `/play?map=village` with battles stubbed. Walk the full route.

- [x] **T055** [US2] Implement `src/core/world/movement.ts` — four-direction grid movement with
      collision against impassable tiles and map bounds (FR-030), as pure functions over a tile grid.
      Kept in core so collision is testable without Phaser.
- [x] **T056** [US2] Test movement: moves in all four directions; blocked by a colliding tile; blocked
      by map bounds; **never ends inside an obstacle**; diagonal input resolves to a single axis.
- [x] **T057** [US2] Implement `src/core/world/mapData.ts` — parse a `.tmj` into a core-side map model:
      collision grid, spawns, transitions. Validate the six contracted layer names and fail loudly on
      a missing one.
- [x] **T058** [US2] Test map parsing: all six layers present; a missing layer fails with the layer
      named; spawns resolve to real npc and monster ids; **every transition has a counterpart in its
      destination map**.
- [x] **T059** [US2] Implement `src/phaser/scenes/WorldScene.ts`: render tilemap layers in contracted
      order (`ground`, `decoration`, entities, `above`), camera follow, player sprite.
- [x] **T060** [US2] Implement player movement and the four-direction walk animation per the sprite
      sheet contract (rows down/left/right/up, columns idle/A/idle/B at 8 fps), driven by `move`
      intents.
- [x] **T061** [P] [US2] Implement map transitions (FR-031): stepping on a transition object loads the
      target map and places the player at the arrival tile facing the contracted direction. Handle a
      failed map load with an error notice, never a black screen.
- [x] **T062** [P] [US2] Implement monster entities from the `spawns` layer with patrol movement
      bounded by `patrolRadius`.
- [x] **T063** [US2] Implement contact-to-battle (FR-032): touching a monster starts a battle against
      its word and returns to the map afterwards at the player's position.
- [x] **T064** [US2] Implement defeated-monster removal — no respawn within the same map visit
      (FR-033), and never respawning under the player on return. Test the tracking rule in core.
- [x] **T065** [P] [US2] Build `src/components/hud/WorldHud.tsx` — the exploration HUD: player HP,
      gold, level, and the journal and menu buttons.
- [x] **T066** [P] [US2] Build the three village / forest / cave map layouts using placeholder
      tilesets, with a walkable route through all three and sensible monster placement.
- [x] **T067** [US2] Verify the exploration guarantee: from any position on any map, movement is
      available and no quiz appears unprompted (Principle I).

**Checkpoint**: ✅ **COMPLETE (2026-08-20)** — 219 tests pass, lint/typecheck/build clean, and
exploration was driven in a real browser: village → forest transition, then walking into the cave
boss started the battle (140/140, Thai prompt, no flee offered).

Found by driving it, not by testing it:
- **Quick taps were dropped.** Movement only polled held keys in `update()`, so a key pressed and
  released between frames was never seen. Tapping a direction and having nothing happen is the
  most frustrating thing a grid RPG can do. Now a `keydown` event moves immediately and `update()`
  only handles hold-to-repeat, sharing one throttle so the two paths cannot double-step.
- **The camera was zoomed too far out** — 32px tiles read as a postage stamp at 1x.

Also fixed: ESLint flat config **replaces** a rule's options when a later block redefines it
rather than merging them, so the repo-wide `.js`-specifier guard silently vanished inside every
layer-scoped block. The pattern is now a shared constant repeated in all six blocks, and it was
verified firing in each layer rather than assumed.

---

## Phase 5: User Story 3 — Learn grammar from NPCs (Priority: P3)

**Goal**: NPCs who are characters teach Present Simple and Past Simple inside dialogue, with practice
that costs no HP.

**Independent Test**: `/play?map=village`, approach the teacher, complete the lesson.

- [x] **T068** [US3] Implement `src/core/dialogue/dialogue.ts` — dialogue tree traversal as pure
      state: current node, advance, branch, embedded practice questions, completion.
- [x] **T069** [US3] Test dialogue traversal: multi-page lines advance in order; branches resolve;
      practice questions surface in sequence; completion is reported once; a dangling `next` id is
      caught at content validation, not at runtime.
- [x] **T070** [US3] Implement `src/core/progression/grammar.ts` — record a topic as learned on first
      lesson completion (FR-036) and expose learned-topic queries to question selection. Test that
      learning a topic makes its dependent questions eligible and that replay does not double-record.
- [x] **T071** [P] [US3] Build `src/components/dialogue/DialogueBox.tsx` and `PortraitFrame.tsx` —
      CSS-framed box, portrait, speaker name, paginated text, advance indicator. Thai text renders
      through the DOM, which is the whole reason for this boundary (R-014).
- [x] **T072** [US3] Wire dialogue rendering to store state, with movement locked for the
      conversation's duration (FR-034).
- [x] **T073** [US3] Implement NPC interaction in `WorldScene`: interact when adjacent **and facing**
      the NPC; only one interaction owns input at a time.
- [x] **T074** [US3] Build `src/components/dialogue/PracticePrompt.tsx` — practice questions rendered
      **inside the dialogue frame in the NPC's voice**, not on a separate quiz screen (FR-035). This is
      the Principle I requirement that keeps lessons diegetic.
- [x] **T075** [US3] Implement in-character correction on a wrong practice answer with **no HP or
      resource loss** (FR-038). Test that no player state except mastery changes during NPC practice.
- [x] **T076** [US3] Implement post-lesson dialogue variation and lesson replay on request (FR-037).
- [x] **T077** [US3] Author the 6 NPCs and their dialogue: teacher (Present Simple), scholar (Past
      Simple), merchant, two villagers, and the castle guard. Data only.
- [x] **T078** [P] [US3] Add a locale switch to the HUD and verify every dialogue and question string
      renders correctly in Thai, including stacked tone marks.

**Checkpoint**: ✅ **COMPLETE (2026-08-20)** — 236 tests pass, lint/typecheck/build clean, and a
lesson was played in a real browser: walked up to ครูมะลิ, pressed E, read the Present Simple
lesson, and answered practice **inside the dialogue frame with her portrait still showing**.

FR-038 is structural rather than promised: `answerPractice` is never handed anything that can
reduce HP, and the browser check asserts zero HP bars exist inside the dialogue box.

Found while authoring: the placeholder generator placed NPCs on a naive stride (`6 + i * 8`),
which ran the sixth villager to tile x=46 on a 20-tile map. The existing map tests did **not**
catch it — an out-of-bounds collision read returns `undefined`, which is falsy, so a spawn past
the east edge looked perfectly walkable. Added explicit in-bounds and no-overlap assertions, and
verified they fail on the original bug before fixing it.

---

## Phase 6: User Story 4 — Vocabulary mastery visible and reviewed (Priority: P4)

**Goal**: The player can see exactly what they know, and previously learned words come back.

**Independent Test**: Drive mastery with a scripted answer sequence, then open the journal.

- [x] **T079** [US4] Implement the review pool: mark a word `encountered` on first battle, and include
      review questions at `balance.questions.reviewProportion` of a battle's draws (FR-020).
- [x] **T080** [US4] Test review selection: the configured proportion is respected over many turns; an
      empty review pool falls back to the monster's word without error; review questions record
      mastery normally.
- [x] **T081** [P] [US4] Build `src/components/journal/MasteryStars.tsx` and
      `ComponentChecklist.tsx` using the contracted star assets.
- [x] **T082** [US4] Build `src/components/journal/WordJournal.tsx` — the word list with per-word
      mastery percentage and per-component mastered state (FR-028), openable from the world and from
      battle.
- [x] **T083** [P] [US4] Add the in-battle mastery indicator showing the word's progress alongside its
      HP, making explicit that **HP and knowledge are different things** (FR-029, and the concept
      document's dual-bar display).
- [x] **T084** [US4] Implement the word-mastered moment: five stars and a restoration beat when the
      last component completes (FR-026).
- [x] **T085** [US4] Test mastery survival across defeat, flee, quit, and reload (FR-027) — never
      reduced by any of them.
- [x] **T086** [US4] Integration test `tests/integration/mastery-progression.test.ts`: a full scripted
      playthrough of one word from 0% to MASTERED through real battles, asserting exact state after
      each answer.
- [x] **T087** [US4] Verify SC-004: every question level 1–5 appears at least once in a normal
      playthrough, asserted over the shipped content.
- [x] **T088** [P] [US4] Verify SC-003 progress: confirm the content counts required for Chapter 1 are
      tracked and reported by the content tests as authoring proceeds.

**Checkpoint**: ✅ **COMPLETE (2026-08-20)** — 246 tests pass, lint/typecheck/build clean.

T079/T080 were already satisfied by Phase 3: the review pool, the configurable proportion, and
the empty-pool fallback all shipped with question selection and are covered by
`tests/unit/questionSelect.test.ts`. Verified rather than rebuilt.

The dual display the concept document asks for is live and confirmed in a browser: the monster's
HP bar and the word's ความเข้าใจ stars sit side by side, so it is unmissable that beating a word
and understanding it are different things (FR-029).

T088 reports Chapter 1's content counts against the SC-003 minimums rather than failing on them.
Grammar, NPCs, items, and pets are already at shipping size; vocabulary and monsters are not, and
T117/T119 close that gap. A test that fails on unfinished authoring would just get skipped.

---

## Phase 7: User Story 5 — RPG rewards for learning (Priority: P5)

**Goal**: XP, gold, items, equipment, and a pet — earned by learning, never bypassing it.

**Independent Test**: Resolve a scripted victory and assert the exact payout; equip each item.

- [x] **T089** [US5] Implement `src/core/progression/rewards.ts` — `applyRewards`: XP, gold, seeded
      drop resolution, level-up against the XP curve, max-HP increase, HP restore (FR-039, FR-040).
- [x] **T090** [US5] Test rewards: payout matches the monster's reward data exactly; XP crossing a
      threshold levels up; max HP rises per config and current HP restores to the new max; a drop at
      chance 0 never occurs and at chance 1 always does; multiple level-ups in one payout work.
- [x] **T091** [US5] Implement `src/core/progression/equipment.ts` — `equip`, and application of the
      data-declared effects (FR-041) for `damage-multiplier`, `damage-reduction`, `first-mistake-free`,
      and `xp-bonus`.
- [x] **T092** [US5] Test equipment effects: a weapon multiplier changes dealt damage; armor reduction
      changes taken damage and **floors at 0**; `first-mistake-free` applies once per battle;
      `xp-bonus` scales XP.
- [x] **T093** [US5] **Write the Principle IV guard test**: enumerate every variant of the `Effect`
      union and assert none can select an option, submit an answer, or skip a question (FR-043). This
      test must fail if someone later adds an answer-revealing effect — that is its purpose.
- [x] **T094** [US5] Implement pet abilities — `usePetAbility` removing exactly one incorrect option,
      limited to `usesPerBattle` (FR-042).
- [x] **T095** [US5] Test the pet ability: removes exactly one option; it is always incorrect; the
      correct answer always survives; uses are consumed and capped per battle; uses reset next battle.
- [x] **T096** [US5] Implement mastery-threshold equipment unlocks (FR-044), telling the player which
      learning milestone earned the item. Test the boundary at exactly N words.
- [x] **T097** [US5] Implement `applyDefeatPenalty` — configurable gold loss and return to the village,
      with **no** reduction to mastery, XP, level, or inventory (FR-014). Test each explicitly.
- [x] **T098** [P] [US5] Build `src/components/battle/VictorySummary.tsx` — XP, gold, drops, level-up,
      and mastery gained this battle. Plus the pet ability button in the battle HUD.
- [x] **T099** [US5] Author 3 items, 1 weapon, 1 armor, and 1 pet (the owl) with unlock conditions tied
      to mastery counts.

**Checkpoint**: ✅ **COMPLETE (2026-08-20)** — 282 tests pass, lint/typecheck/build clean, and a
win was played out in a browser: flee offered on a non-boss, no pet button without a pet equipped,
and a victory summary reading ค่าประสบการณ์ +40 / เหรียญทอง +15 — exactly `monster-eat`'s reward
data.

**T093 is the load-bearing test of this phase.** It enumerates every variant the `Effect` schema
permits and asserts the list matches an explicit allow-list. If anyone later adds `auto-answer`,
`reveal-correct`, or `skip-question`, that test fails — which is its entire purpose. FR-043 is
now checkable rather than aspirational.

Rewards land the moment victory is decided, not when the summary is dismissed, so closing the tab
on the victory screen cannot cost the payout.

T099's items were authored in Phase 2 and are covered by the content tests; verified rather than
re-authored.

---

## Phase 8: User Story 6 — Chapter challenge (Priority: P6)

**Goal**: The castle guard tests everything Chapter 1 taught. Passing completes the chapter.

**Independent Test**: `/play?challenge=chapter-1`; pass it and fail it.

- [x] **T100** [US6] Implement `src/core/chapter/challenge.ts` — `startChallenge`, `answerChallenge`,
      `finishChallenge`, `isChallengeUnlocked`, with `ChallengeState` carrying **no HP field** so the
      challenge structurally cannot damage the player (FR-047).
- [x] **T101** [US6] Implement the boss gate: the challenge is unavailable until the chapter boss is
      defeated (FR-045). Test both states.
- [x] **T102** [US6] Implement challenge question drawing restricted to the chapter's declared
      vocabulary and grammar (FR-046), freshly drawn per attempt (FR-047).
- [x] **T103** [US6] Test challenge scoring: at exactly the pass threshold it passes; one below fails;
      the chapter is marked complete and its reward granted **only** on a pass (FR-048); failure
      preserves all mastery gained during the attempt; retries are unlimited and redraw questions.
- [x] **T104** [US6] Implement weakest-topic reporting so the guard names what the player struggled
      with, in character.
- [x] **T105** [US6] Build `src/components/challenge/ChallengePanel.tsx` — dialogue-framed, in the
      guard's voice, with visible progress. A story moment at a gate, not an exam screen (Principle I).
- [x] **T106** [US6] Implement the gate opening and the chapter completion sequence on a pass.
- [x] **T107** [US6] Author the chapter challenge content: the guard's dialogue for the challenge, for
      passing, and for each failure case, in both locales.
- [x] **T108** [US6] Integration test `tests/integration/chapter-completion.test.ts`: boss defeated →
      challenge unlocked → passed → chapter complete → reward granted, end to end.

**Checkpoint**: ✅ **COMPLETE (2026-08-20)** — 307 tests pass, lint/typecheck/build clean.

`ChallengeState` has no HP field and this module contains no damage function, so FR-047 holds by
construction: a future change cannot accidentally reintroduce damage here because there is
nothing to reintroduce it into. A test asserts the absent keys explicitly.

Talking to the guard is context-sensitive. Before the boss falls he tells you to go and free the
word in the cave; after, the same interaction opens the challenge instead of small talk — a gate,
not a menu option.

Failure names the weakest topics in his voice. A failure that does not say what to study is just
a wall.

---

## Phase 9: User Story 7 — Save and load (Priority: P7)

**Goal**: Progress survives closing the game.

**Independent Test**: Serialize a fully populated state, deserialize into a fresh runtime, assert deep
equality.

- [ ] **T109** [US7] Implement `src/core/save/serialize.ts` — the versioned envelope from
      [contracts/save-format.md](./contracts/save-format.md), with a Zod schema for the save document
      and no optional fields with silent defaults.
- [ ] **T110** [US7] Implement `src/platform/LocalStorageSaveRepository.ts` against the core interface,
      including the `isAvailable()` writability probe. **Instantiated only inside the client-mounted
      game**, never at module scope — `localStorage` does not exist during SSR (R-010).
- [ ] **T111** [US7] **Write the round-trip test** (SC-010, FR-054): build a `PlayerState` with every
      field populated non-trivially — several words at different mastery stages, a partial streak, a
      demoted component, multiple inventory entries, all three equipment slots, both chapter progress
      states — serialize, deserialize, assert deep equality.
- [ ] **T112** [US7] Test every load-failure path: absent key → new game; malformed JSON → unreadable;
      schema violation → unreadable with the field path; newer `schemaVersion` → unreadable; storage
      throwing → `isAvailable() === false` (FR-055, FR-056).
- [ ] **T113** [US7] Implement save triggers: battle end, lesson completion, map transition, challenge
      attempt, inventory and equipment change. **Not** mid-battle.
- [ ] **T114** [US7] Implement load-on-start with the new-game path when no save exists, and the
      player-facing "save could not be read" screen offering a new game — never a crash (FR-055).
- [ ] **T115** [US7] Implement the storage-unavailable warning so the player knows progress will not
      persist (FR-056).
- [ ] **T116** [US7] Test the interrupted-battle rule: quitting mid-battle does not resume the battle,
      but mastery earned during it is already persisted.

**Checkpoint**: The slice can be played across multiple sittings.

---

## Phase 10: Content, Polish, and Validation

**Purpose**: Fill the chapter to shipping size, verify the constitution's promises hold, and gather
the evidence this MVP exists to produce.

- [ ] **T117** [POLISH] Author the full Chapter 1 vocabulary — expand to **30+ words** at A1 with
      meanings in both locales, word families, and examples (SC-003).
- [ ] **T118** [POLISH] Author the full question set — every derived component of every word covered,
      levels 1–5 represented, all four difficulty tiers used, explanations in both locales.
- [ ] **T119** [POLISH] Author the remaining monsters to 6 plus the `go` boss, with HP and attack tuned
      so a fight lasts a designed number of turns.
- [ ] **T120** [POLISH] Write the Chapter 1 story beats: the opening that introduces The Silence, the
      Word Keeper's role, the arc through village → forest → cave, and the castle gate. Both locales.
- [ ] **T121** [POLISH] **Verify SC-008 by doing it**: add one new vocabulary word with its questions
      and one new monster, editing content files only. If any source file must change, fix the engine —
      that is a Principle III violation, not an acceptable limitation.
- [ ] **T122** [P] [POLISH] Balance pass: tune `balance.json` so battles last 4–6 turns, the chapter
      runs 45–90 minutes (SC-002), and the first battle is reachable within 3 minutes (SC-001).
- [ ] **T123** [P] [POLISH] Verify SC-007 — the full suite finishes in under 30 seconds. If it does
      not, find the test that touched a browser.
- [ ] **T124** [P] [POLISH] Verify SC-006 — 100% coverage of state-changing rules in `src/core/`.
- [ ] **T125** [P] [POLISH] Full locale audit: both bundles complete (SC-009), every content file
      localized, Thai rendering verified including combining vowels and tone marks, and **no
      target-language English accidentally translated** (FR-052).
- [ ] **T126** [P] [POLISH] Performance and layout pass: verify SC-011 — stable frame rate in the
      canvas during exploration and battle, no perceptible input lag on answer selection, and no React
      re-render storm from store subscriptions. Responsive layout, desktop first, verified at mobile
      viewport sizes. Touch controls explicitly not required.
- [ ] **T127** [POLISH] **Anti-quiz review**: play the slice and check it reads as an RPG, not a web
      form. HTML makes drifting easy; Principle I makes it fatal. Fix anything that looks like a
      questionnaire.
- [ ] **T128** [POLISH] Replace placeholders with the owner's art as it arrives, in the asset
      contract's priority order. Confirm each drop-in needs **zero** code changes.
- [ ] **T129** [POLISH] Implement a server-backed `SaveRepository` adapter in `src/platform/` — the
      final MVP task. It must require **no** changes to any gameplay module. If it does, Principle II
      was violated somewhere earlier and that is the real bug.
- [ ] **T130** [POLISH] **Run the playtest that justifies this whole project** (SC-012): at least 5
      testers complete the vertical slice and answer whether the battle loop was fun. Write up what
      they said. This is the deliverable the MVP exists to produce.

---

## Out of scope for this feature

Not tasks. Listed so nobody adds them by reflex:

- Socket.IO, the realtime server, presence, matchmaking, and the Stage 2 shared open world.
- Accounts, authentication, leaderboards, profile and settings pages.
- Any `multiplayer` config key, socket client stub, or presence type (T007's lint rule blocks these).

Stage 2 gets its own specification after the Stage 1 playtest. Per R-017, the retrofit cost is near
zero because state already serializes losslessly for saves — building the transport before knowing
what it carries is what would be expensive.

---

## Dependencies

```text
Phase 1 (Setup)
   ↓
Phase 2 (Foundational) ──── blocks everything below; includes the runtime bridge
   ↓
Phase 3 (US1 Battle) 🎯 ─── the hypothesis; playtest before continuing
   ↓
Phase 4 (US2 World)
   ↓
Phase 5 (US3 NPCs)
   ↓
Phase 6 (US4 Mastery) ───── review needs US2's repeat encounters
   ↓
Phase 7 (US5 Rewards) ───── needs US1 battle + US4 mastery counts
   ↓
Phase 8 (US6 Challenge) ─── needs US3 grammar + US4 mastery + a boss from US1
   ↓
Phase 9 (US7 Save/Load) ─── needs every state-owning system to exist
   ↓
Phase 10 (Polish)
```

**Within a phase**, tasks marked `[P]` touch different files and can run in parallel. Unmarked tasks
depend on the task immediately before them.

**Cross-story note**: US4's mastery *engine* is in Phase 2 because US1 cannot select questions without
it. Phase 6 delivers what the *player* sees of mastery — the journal, the review loop, the stars.

## Implementation Strategy

**Stop after Phase 3 and playtest.** Phase 3 delivers a complete, playable battle. That is enough to
answer whether the core loop is fun, which is the entire purpose of this MVP. Building Phases 4
through 10 before getting that answer is exactly the risk the concept document warns against in §23.

If the loop is not fun, the cheapest moment to learn it is at the end of Phase 3.

## Task Summary

| Phase | Tasks | Story | Delivers |
|---|---|---|---|
| 1 | T001–T011 | SETUP | Next.js app that builds, lints, type-checks, tests; Thai fonts verified |
| 2 | T012–T032 | FOUND | Content pipeline, i18n, RNG, player state, mastery engine, runtime bridge, placeholders |
| 3 | T033–T054 | US1 (P1) | 🎯 A complete playable battle — the hypothesis |
| 4 | T055–T067 | US2 (P2) | Three maps, movement, collision, visible encounters |
| 5 | T068–T078 | US3 (P3) | NPCs who teach grammar in character |
| 6 | T079–T088 | US4 (P4) | Visible mastery and the review loop |
| 7 | T089–T099 | US5 (P5) | XP, gold, equipment, pets — none of which bypass learning |
| 8 | T100–T108 | US6 (P6) | The chapter challenge and an earned ending |
| 9 | T109–T116 | US7 (P7) | Persistent progress |
| 10 | T117–T130 | POLISH | Full content, balance, real art, server saves, and the playtest |

**Total**: 130 tasks. **MVP-critical path to a testable hypothesis**: T001–T054.
