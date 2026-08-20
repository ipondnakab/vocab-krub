# Implementation Plan: Chapter 1 Vertical Slice

**Branch**: `001-chapter1-vertical-slice` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/001-chapter1-vertical-slice/spec.md`

**Stack revision**: 2026-08-20 — Next.js + React + Phaser, per owner decision. Constitution amended
to v1.1.0. Socket.IO is Stage 2 and appears nowhere in this feature.

## Summary

Build the complete Chapter 1 vertical slice of Vocab Krub — **Stage 1, the single-player learning
campaign**. A Word Keeper explores a village, forest, and cave; learns Present Simple and Past Simple
from NPCs who are characters; fights visible vocabulary monsters in turn-based combat where a correct
answer is an attack and a wrong answer is an opening; builds per-component word mastery; earns XP,
gold, equipment and a pet; and proves what they learned at a castle gate to complete the chapter.

The technical approach is a strict layered split with **two renderers over one rules layer**. All game
rules — battle resolution, question selection, answer grading, mastery, rewards, chapter progression,
save shaping — live in framework-free TypeScript under `src/core/`, driven entirely by validated
content data. A thin runtime bridge holds current state and mediates. React renders every piece of
text the player reads; Phaser renders everything the player watches. Neither renderer imports the
other, and neither owns a rule.

That split is what makes a 30-second Node test suite cover 100% of state-changing logic (SC-006), and
it is also why this stack change cost nothing in the rules layer — `src/core/` is byte-for-byte
unaffected by moving from Vite to Next.js.

## Technical Context

**Language/Version**: TypeScript 5.9.3 in `strict` mode, Node.js 24 LTS

**Primary Dependencies**: Next.js 16 (App Router), React 19, Phaser 3.90.0 (client-only), Zod 4
(content schema validation), ESLint 10 (including the layering boundary rules)

**Storage**: Browser `localStorage` behind a `SaveRepository` interface owned by `src/core/`. Adapter
is client-only; nothing persists server-side in this feature.

**Testing**: Vitest 4 for all rules tests, Node environment, no DOM, no React, no Phaser. Content data
is validated by the same Zod schemas the game uses at load time, run as a test.

**Target Platform**: Modern desktop browsers (Chromium, Firefox, Safari current versions). Layout is
responsive and verified on mobile viewports; touch controls are not a shipping requirement.

**Project Type**: Next.js web application with an embedded Phaser game canvas. No backend service, no
API routes required by gameplay.

**Performance Goals**: 60 fps in the Phaser canvas during exploration and battle on a mid-range
laptop. Answer selection registers visible feedback within 100 ms. Rules test suite under 30 seconds
(SC-007).

**Constraints**: Stage 1 is **fully offline-capable after first load** — no runtime network call is
required to play. Content and locale bundles ship with the build. `src/core/` must not import Phaser,
React, Next, or any DOM API. Phaser must never be evaluated during SSR.

**Scale/Scope**: 3 maps, ~30 vocabulary words, ~120 questions, 6 NPCs, 6 monsters plus 1 boss, 2
grammar topics, 3 items, 1 pet, 1 chapter challenge. Two complete locale bundles (`th`, `en`).

**Explicitly absent**: Socket.IO, multiplayer, presence, accounts, and the open world. Those are
Stage 2, specified separately, and must not be scaffolded here (Constitution: Product Shape).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Vocab Krub Constitution **v1.1.0**.

| Principle | Gate | Status |
|---|---|---|
| I. Game First, Quiz Never | Is every planned system justifiable as a JRPG feature? Are lessons diegetic? Is exploration ever gated by an unprompted quiz? | **PASS** — Battle, exploration, dialogue, equipment, and pets are standard JRPG systems. Grammar lessons render inside the dialogue frame (FR-035). The chapter challenge is a guard at a gate. Encounters are visible and player-initiated. The React UI is styled as an RPG interface, not as a web form — this is called out explicitly in the UI tasks because HTML makes it easy to drift into looking like a quiz app. |
| II. Separation of Engine, Rules, and Rendering | Can every rule run without a renderer? Do the two renderers stay independent? Is the bridge rule-free? | **PASS** — All rules in `src/core/`, zero Phaser/React/Next imports. React and Phaser both read state through `src/runtime/` and never import each other. The bridge holds state and dispatches; it computes nothing. Four ESLint boundary rules enforce this, so it is checked rather than trusted. |
| III. Content Is Data, Not Code | Can a word, monster, NPC, or question be added with no engine change? Are all balance numbers in config? Does invalid content fail loudly? | **PASS** — Content in `src/content/data/` as JSON validated by Zod. Every tunable resolves from `balance.json`. Validation failure names file and field path. SC-008 is verified by an explicit task that adds a word and a monster with zero source edits. |
| IV. Pedagogical Honesty | Is mastery component-scoped and streak-gated? Can any item answer a question? Are wrong answers taught? Are exam claims avoided? | **PASS** — Mastery requires consecutive correct answers per component (FR-024). FR-043 forbids any effect that selects, submits, or skips, asserted by a test over the closed `Effect` union. FR-004 requires the correct answer plus explanation on every miss, before the counterattack. No IELTS/TOEFL content in scope. |
| V. Test Every Rule That Changes Player State | Does every HP/XP/gold/mastery/inventory/chapter/save rule have tests covering normal, failure, boundary, transition, and round-trip? | **PASS** — Each core module ships with its tests in the same task. Boundary cases are named individually in tasks.md. React components and Phaser scenes are exempt as rendering, exactly as the principle allows. |
| VI. Vertical Slice Discipline | Any speculative abstraction? Any stubs for unspecified features? Is everything traceable to the spec? | **PASS** — No plugin system, no ECS, no state-machine library, no service layer. Two interfaces are introduced (`SaveRepository`, the runtime bridge); both are justified in Complexity Tracking with two live consumers each. **Stage 2 gets nothing**: no socket dependency, no presence types, no multiplayer config keys. |
| VII. Preserve Working Behavior | Does the plan avoid refactoring working code, and version the save format? | **PASS** — Still greenfield; the stack changed before any source existed, which is the cheapest possible moment. The save format carries a schema version from its first write (FR-055). |
| Product Shape: Two Stages | Is Stage 2 kept entirely out? Does Stage 1 run with no network? Is the completion gate real? | **PASS** — Socket.IO is not a dependency. Stage 1 requires no runtime network call. The campaign completion gate is Chapter N's challenge, and this feature ships Chapter 1's, establishing the mechanism. |

**Technology constraints check**: TypeScript strict ✅, Next.js 16 App Router ✅, React 19 for text UI
✅, Phaser 3 client-only for world ✅, Vitest ✅, the seven prescribed directories ✅, bilingual from
first commit ✅, `SaveRepository` with a local adapter ✅, owner-supplied world art behind a documented
contract with UI as CSS ✅, question levels 1–5 only ✅, no Socket.IO ✅.

**Result**: All gates pass. Proceed to Phase 0.

**Post-Phase-1 re-check**: All gates still pass. The Phase 1 design added the runtime bridge contract
and reduced the asset contract (UI chrome became CSS); neither introduced a rule outside `src/core/`
nor a tunable outside `balance.json`.

## Project Structure

### Documentation (this feature)

```text
specs/001-chapter1-vertical-slice/
├── spec.md              # Feature specification
├── plan.md              # This file
├── research.md          # Phase 0 — technical decisions and rationale
├── data-model.md        # Phase 1 — entities, fields, relationships, state rules
├── quickstart.md        # Phase 1 — how to run, test, and add content
├── contracts/           # Phase 1 — module and data contracts
│   ├── content-schemas.md   # Shape and validation rules for every content file
│   ├── core-api.md          # The rules surface renderers are allowed to call
│   ├── runtime-bridge.md    # How React and Phaser share one state
│   ├── save-format.md       # Versioned save schema and migration policy
│   └── asset-contract.md    # What the owner's world and character art must conform to
└── tasks.md             # Phase 2 output
```

### Source Code (repository root)

```text
app/                          # Next.js App Router
├── layout.tsx                # Root layout, locale provider, fonts
├── page.tsx                  # Landing page
├── play/page.tsx             # The game route — mounts the canvas client-side only
└── globals.css

src/
├── core/                     # Framework-free rules. No Phaser, React, Next, or DOM.
│   ├── battle/               # Turn resolution, damage, victory/defeat, flee
│   ├── questions/            # Selection, presentation, grading, difficulty→damage
│   ├── mastery/              # Component streaks, promotion, demotion, word %
│   ├── progression/          # XP, levels, gold, rewards, equipment unlocks, grammar
│   ├── chapter/              # Chapter state, boss gate, challenge scoring
│   ├── player/               # Player state shape and mutations
│   ├── world/                # Grid movement, collision, map model
│   ├── dialogue/             # Dialogue tree traversal
│   ├── save/                 # SaveRepository interface, serialize, versioning
│   ├── content/              # Loading, schema validation, indexed lookup
│   ├── i18n/                 # Locale resolution and missing-key policy
│   ├── rng/                  # Seeded PRNG
│   └── config/               # Balance config access
│
├── runtime/                  # The bridge. Holds state, dispatches intents. No rules.
│   ├── GameStore.ts          # Subscribable state container
│   ├── intents.ts            # Typed commands renderers send inward
│   └── useGameState.ts       # React binding via useSyncExternalStore
│
├── phaser/                   # Phaser only. Never imports React.
│   ├── game.ts               # Phaser config and instance lifecycle
│   ├── scenes/
│   │   ├── BootScene.ts
│   │   ├── PreloadScene.ts
│   │   ├── WorldScene.ts     # Tilemap, movement, NPCs, monster entities
│   │   └── BattleScene.ts    # Monster sprite, attack/hurt animation, effects
│   └── sprites/
│
├── components/               # React only. Never imports Phaser.
│   ├── GameCanvas.tsx        # Mounts Phaser, ssr:false
│   ├── battle/               # QuestionPanel, OptionList, FeedbackPanel, HpBar
│   ├── dialogue/             # DialogueBox, PortraitFrame, PracticePrompt
│   ├── journal/              # WordJournal, MasteryStars, ComponentChecklist
│   └── hud/                  # HUD shell, menus, locale switch
│
├── content/
│   ├── schemas/              # Zod schemas — single source of truth for content shape
│   └── data/                 # balance, vocabulary, questions, grammar, monsters,
│                             # npcs, dialogue, items, pets, chapters
│
├── locales/                  # th.json, en.json
│
└── platform/
    └── LocalStorageSaveRepository.ts

public/assets/                # Owner-supplied world and character art, tilemaps, audio
└── placeholder/              # Generated conforming placeholders

scripts/generate-placeholders.ts

tests/
├── unit/                     # Per-module core rules tests
├── integration/              # Full battle, chapter completion, save round-trip
└── content/                  # Schema validation, locale parity, asset contract
```

**Structure Decision**: A single Next.js application. `app/` holds routes; the game lives at `/play`
and mounts Phaser through a `ssr: false` dynamic import, because Phaser touches `window` at module
scope and would break server rendering.

The constitution's dependency rules are enforced by four ESLint boundary rules rather than by
convention:

```text
app → components → runtime → core       ✅
app → phaser     → runtime → core       ✅
components → phaser                      ❌ lint error
phaser → components                      ❌ lint error
core → phaser | react | next | window    ❌ lint error
```

There is no backend package and no API route required by gameplay, because Stage 1 needs no server.

## Phase Outputs

- **Phase 0** — [research.md](./research.md): every technical decision with rationale, including the
  Next.js integration approach, the React/Phaser boundary, the state bridge, Thai typography, and the
  Stage 2 deferral.
- **Phase 1** — [data-model.md](./data-model.md) and [contracts/](./contracts/): entity shapes,
  content schemas, the core API, the runtime bridge, the versioned save format, and the asset
  contract. [quickstart.md](./quickstart.md) covers running, testing, and adding content.
- **Phase 2** — [tasks.md](./tasks.md).

## Complexity Tracking

> Filled only where the Constitution Check surfaced something needing justification.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| `SaveRepository` interface with one implementation (tension with Principle VI's "two concrete use cases") | The constitution's Persistence clause mandates it by name, and a server-backed adapter is already scheduled as the final MVP task. The second implementation is scheduled, not speculative. | Calling `localStorage` directly from core would put a DOM API inside `src/core/` — breaking Principle II outright, and breaking SSR, since Next evaluates modules on the server. |
| The `src/runtime/` bridge layer — a new indirection between rules and rendering | Principle VI requires two concrete consumers before an abstraction. There are exactly two, today, not hypothetically: React and Phaser must render the same battle without disagreeing about turn or HP. A shared subscribable state container is the minimum mechanism that guarantees that. | Letting each renderer hold its own copy of state was rejected: two copies of HP is two chances to drift, and the bug would appear as a visual desync mid-battle — expensive to find, trivial to prevent. Having React own state and pass it into Phaser was rejected because it makes Phaser's lifecycle depend on React's render cycle. |
| Two locale bundles maintained from the first commit | Owner decision. Retrofitting localization means touching every string site in every component — exactly the refactor Principle VII warns against. | Hardcoding English first and extracting later would cost more across ~10 screens and ~120 questions than the flat per-string cost of doing it right from the start. |
