<!--
Sync Impact Report
==================
Version change: 1.0.0 → 1.1.0
Rationale: Stack amendment. The project owner changed the delivery stack to Next.js + React +
Phaser, with Socket.IO reserved for a Stage 2 shared open world. Principles I–VII are unchanged
in substance; Principle II gains an explicit third consumer (React) and the runtime bridge rule.
Technology & Content Constraints rewritten. New "Product Shape: Two Stages" section added.

Modified principles:
  - II. Separation of Engine, Rules, and Rendering — expanded: rules now serve TWO renderers
    (React DOM and Phaser), which must not import each other. Substance unchanged.

Added sections:
  - Product Shape: Two Stages

Rewritten sections:
  - Technology & Content Constraints (engine, architecture boundaries, UI boundary, assets)

Removed sections: N/A

Templates requiring updates:
  - .specify/templates/plan-template.md      ✅ compatible
  - .specify/templates/spec-template.md      ✅ compatible
  - .specify/templates/tasks-template.md     ✅ compatible
  - .specify/templates/checklist-template.md ✅ compatible

Downstream artifacts updated in the same amendment:
  - specs/001-chapter1-vertical-slice/plan.md         ✅ updated
  - specs/001-chapter1-vertical-slice/research.md     ✅ updated (R-001, R-013…R-017 added)
  - specs/001-chapter1-vertical-slice/spec.md         ✅ updated (Stage framing, Out of Scope)
  - specs/001-chapter1-vertical-slice/tasks.md        ✅ updated (Phases 1, 3–8 UI tasks)
  - specs/001-chapter1-vertical-slice/contracts/      ✅ asset-contract reduced; runtime-bridge added

Follow-up TODOs: none. All placeholders resolved.
-->

# Vocab Krub Constitution

Vocab Krub is a 2D turn-based JRPG in which a player learns English by playing a real
role-playing game. This constitution governs how the game is built. It exists to protect two
things that are easy to lose: **the game must be a game**, and **the learning must be real**.

## Core Principles

### I. Game First, Quiz Never (NON-NEGOTIABLE)

Vocab Krub is an RPG that teaches, not a quiz with sprites bolted on. Every feature MUST be
justifiable as something a player would want in a JRPG even if the questions were removed.

Concretely:

- Learning MUST be delivered through diegetic fiction — NPCs who are characters, monsters who
  are forgotten words, towns the player walks through — never through a screen that announces
  itself as a test.
- A player MUST always be able to move, explore, and talk. Exploration is never gated behind a
  mandatory quiz screen that appears without narrative cause.
- Monsters are not enemies to be hated. Copy, art, and defeat animations MUST reflect that a
  defeated word is *restored*, not killed. The Silence is the antagonist; the words are victims.
- If a design decision makes the product feel more like Anki and less like Final Fantasy, it is
  the wrong decision, regardless of its measured learning efficiency.

**Rationale**: The entire premise under test is "is learning English through a real RPG battle
loop actually fun?" A build that drifts into quiz-with-graphics cannot answer that question,
because it never tested it.

### II. Separation of Engine, Rules, and Rendering (NON-NEGOTIABLE)

Game rules MUST be implementable, runnable, and testable with no Phaser instance, no canvas, no
DOM, and no browser.

- Battle rules, question selection, answer grading, mastery tracking, XP/reward calculation,
  chapter progression, and save-state shaping MUST live in framework-free TypeScript modules
  that import nothing from Phaser.
- Phaser scenes are an **adapter layer**. They read state and emit intents; they do not own
  rules. A scene MUST NOT be the only place a rule exists.
- Any rules module MUST be exercisable from a plain Node test with no rendering harness. If a
  rule can only be tested by launching the game, it is in the wrong layer.
- Communication between rules and rendering flows through explicit typed events/commands, not
  through shared mutable globals or scene-reaching-into-scene access.
- Rules serve **two** renderers: React DOM for text and HUD, Phaser for the world and sprites.
  Neither renderer may import the other. Both read the same state through the runtime bridge, so
  the two views can never disagree about whose turn it is or how much HP remains.
- The runtime bridge holds current game state and mediates. It MUST NOT contain rules: if a
  calculation lives in the bridge rather than in `src/core/`, it is misplaced.

**Rationale**: Rules coupled to rendering cannot be tested, cannot be balanced, and cannot be
reused when the presentation changes. This is the single highest-leverage structural rule in the
project — and it is what let the stack change from Vite to Next.js without touching a single
rule.

### III. Content Is Data, Not Code (NON-NEGOTIABLE)

Vocabulary, word families, questions, grammar lessons, monsters, NPCs, dialogue, items, pets,
chapters, rewards, and every balancing number MUST live in versioned data files validated
against an explicit schema — never inline in gameplay logic.

- Adding a word, a monster, an NPC, a question, or a whole chapter MUST require zero engine
  changes.
- Damage values, HP totals, XP curves, mastery thresholds, and drop rates MUST be resolved from
  a balance configuration file, not written as literals at the call site.
- All content MUST be schema-validated. Invalid content MUST fail loudly at build or load time
  with a message naming the offending file and field — never fail silently or half-load.
- A literal number in gameplay code is a defect unless it is a structural constant (array
  index, frame count, tile size) that no designer would ever tune.

**Rationale**: The long-term product is dozens of chapters of content authored by people who are
not engineers. An engine that requires a code change per word cannot reach that scale.

### IV. Pedagogical Honesty

The game MUST NOT overstate what it teaches or what it measures.

- Mastery MUST be earned per component (meaning, each word form, usage in context), tracked
  independently, and never inferred from a single lucky answer. A correct guess on a
  four-option question is not evidence of knowledge.
- Equipment, pets, and items MAY reduce the cost of being wrong, grant hints, or improve
  rewards. They MUST NEVER answer a question for the player or let a player progress past
  content they have not engaged with. No item may bypass the learning requirement.
- CEFR levels (A1–C2) are the project's progression vocabulary and MAY be stated.
- The game MUST NOT present a score, band, or result as an IELTS, TOEFL, or other proprietary
  exam score. Practice material MAY be described as *inspired by* those formats. Unvalidated
  assessments MUST NOT claim official equivalence, in UI copy, marketing, or data field names.
- Wrong answers MUST teach. Every incorrect response MUST show what the correct answer was and
  why, before the turn resolves.

**Rationale**: This product's value proposition is that the learning is genuine. Inflated claims
and hollow mastery destroy that in a way no amount of polish repairs.

### V. Test Every Rule That Changes Player State

Any logic that can change HP, XP, gold, mastery, inventory, chapter unlock status, or save data
MUST have automated tests before it is considered complete.

Required coverage for every such rule:

- The normal path (correct answer, expected input, happy state).
- The failure path (wrong answer, monster attack, player defeat).
- Boundary conditions (HP hitting exactly zero, mastery hitting exactly 100%, last question in
  a pool, empty pool, final chapter).
- State transitions (explore → battle → victory/defeat → explore; chapter N → chapter N+1).
- Save/load round-trips: any state that persists MUST prove it survives a serialize/deserialize
  cycle unchanged.

Rendering, animation, audio, and asset loading are explicitly exempt — those are validated by
playing the game.

**Rationale**: Educational progress is the player's investment. A bug that silently loses
mastery or double-counts damage is more costly here than a visual glitch, and is invisible
without tests.

### VI. Vertical Slice Discipline

Build the smallest complete thing that proves the concept. Breadth is deferred until the loop is
validated as fun.

- No speculative abstraction. Do not add a plugin system, an entity-component framework, a state
  machine library, or a service layer because a future chapter "might need it." Two concrete
  use cases MUST exist before an abstraction is introduced.
- No placeholder architecture for unspecified features. A feature mentioned in the concept
  document but not currently specified is future scope and MUST NOT get stub files, empty
  interfaces, or dead configuration keys.
- Extensibility is achieved through Principle III (data-driven content), not through layers of
  indirection in code.
- Every feature MUST be traceable to an approved specification. Unrequested features are
  rejected in review even if they work.

**Rationale**: Ten chapters of scaffolding built before anyone confirms the core loop is fun is
ten chapters of work at risk. The MVP's only job is to answer one question.

### VII. Preserve Working Behavior

Once a feature meets its acceptance criteria, it MUST keep meeting them.

- New work MUST NOT refactor unrelated working code. Refactoring is its own task with its own
  justification.
- Changes that alter existing behavior MUST be accompanied by a specification change explaining
  why, and the affected tests MUST be updated deliberately, never deleted to make a suite pass.
- Save data format changes MUST include a migration path or an explicit, documented decision to
  invalidate old saves.

**Rationale**: A vertical slice is only convincing if it holds together end to end. Regressions
in earlier steps invalidate the demonstration of later ones.

## Technology & Content Constraints

**Stack**

- **Next.js 16** (App Router) for routing, the surrounding web application, and the build.
- **React 19** for all text and HUD user interface.
- **Phaser 3** for the world, sprites, tilemaps, animations, and battle visual effects. Mounted
  client-side only; it MUST NOT be imported into a server component or evaluated during SSR.
- **TypeScript** in `strict` mode across the entire codebase. `any` requires an inline
  justification comment. Content data is typed and schema-validated.
- **Vitest** for unit and integration testing of rules modules, in a Node environment.
- **Socket.IO** is reserved for Stage 2 and MUST NOT appear in Stage 1 code, dependencies, or
  configuration.

**Architecture boundaries**

- `app/` — Next.js routes and layouts.
- `src/core/` — framework-free game rules. MUST NOT import Phaser, React, Next, DOM APIs, or
  `window`.
- `src/content/` — data files and their schemas. Same import restrictions as `src/core/`.
- `src/runtime/` — the bridge. Owns current game state, subscribes renderers, dispatches intents
  into `src/core/`. Contains no rules.
- `src/phaser/` — Phaser scenes and world rendering. The only layer permitted to import Phaser.
  MUST NOT import React.
- `src/components/` — React components. MUST NOT import Phaser.
- `src/platform/` — adapters for storage and other host services, each behind an interface owned
  by `src/core/`.

The dependency rule is one-directional:

```text
app → components → runtime → core
app → phaser     → runtime → core
components ⇄ phaser  FORBIDDEN
core → anything above it  FORBIDDEN
```

This MUST be enforced by lint rule, not by convention alone.

**UI boundary**

- React owns every piece of text the player reads: questions, answer options, dialogue, wrong-answer
  explanations, HP and mastery readouts, menus, and the journal.
- Phaser owns everything the player watches: the tilemap, character and monster sprites, movement,
  attack and hurt animations, and scene transitions.
- The boundary is chosen deliberately for Thai typography. Combining vowels and tone marks position
  correctly in DOM text and are unreliable in canvas bitmap text, and this game is text-heavy in two
  languages.
- A component that renders player-visible text in Phaser is a defect unless it is diegetic world
  art (a signpost, a shop banner) baked into a tileset.

**Localization**

- The project is bilingual (Thai and English) from the first commit. No user-visible string may
  be hardcoded in a component or scene; all display text resolves through the locale layer.
- Locale bundles MUST be complete for `th` and `en` before a feature is considered done. A
  missing key MUST surface visibly in development rather than silently falling back.
- English content under test (the vocabulary, the target sentences, the grammar being taught) is
  **not** translatable content. Only instruction, UI chrome, meanings, and explanation are.

**Persistence**

- All persistence flows through a `SaveRepository` interface owned by `src/core/`.
- Stage 1 ships a local storage adapter, client-side only. A server-backed adapter is added as a
  final MVP task and MUST NOT require changes to any gameplay module to swap in.

**Assets**

- Art, tilemaps, and audio are supplied by the project owner. Engineering MUST define and
  document an explicit asset contract — dimensions, sprite sheet frame order, animation naming,
  tile IDs, map layer names — and build against that contract using generated placeholders.
- Placeholder art MUST be visually obvious as placeholder and MUST be replaceable by dropping in
  conforming files with no code change.
- UI chrome — dialogue frames, buttons, panels, bars — is CSS, not art. The asset contract covers
  world and character art only.

**Scope boundary for the MVP**

Question types Level 1 through Level 5 (meaning, recognition, word form, fill-in-the-blank,
context) are in scope. Level 6 sentence creation and all free-text grading are out of scope for
the MVP and MUST NOT be partially implemented.

## Product Shape: Two Stages

Vocab Krub ships in two stages. Confusing them is the most likely way this project loses focus.

**Stage 1 — The Learning Campaign (current scope).** Single-player. The player works through
chapters of mission quests, learning vocabulary and grammar, fighting corrupted words, and passing
chapter challenges. Fully offline-capable: no network call is required to play. This is what the
MVP validates.

**Stage 2 — The Shared Open World (future scope).** Unlocked only after the player completes all
mission quests. Word Keepers who have finished the campaign enter a persistent shared world
together, connected over Socket.IO. This is a separate feature with its own specification.

Rules that follow from this split:

- Stage 2 MUST NOT be built, stubbed, or scaffolded during Stage 1. No socket client, no presence
  types, no `multiplayer` config keys, no "we'll need this later" abstractions. Principle VI applies
  with full force.
- Stage 1 MUST remain playable with no network connection, and MUST NOT degrade if a Stage 2
  service is unreachable.
- Stage 2 inherits every principle here. In particular, Principle IV: a shared world MUST NOT
  become a place where players trade answers, and Principle I: it MUST be a world, not a lobby.
- The campaign completion gate is the entry condition to Stage 2. It MUST NOT be bypassable by
  purchase, invitation, or configuration, because arriving there is the proof of learning that
  makes the shared world meaningful.

## Development Workflow & Quality Gates

**Spec-driven order is mandatory.** Every feature moves through: Specify → Clarify → Plan →
Tasks → Implement → Test → Review. Implementation MUST NOT begin before the specification and
task breakdown for that feature exist and are approved.

**Clarify before deciding.** When a requirement is ambiguous and the interpretations lead to
materially different work, ask. Do not silently pick an interpretation for a significant
gameplay, pedagogical, or architectural decision. Routine judgment calls are made and recorded
in the spec's Assumptions section.

**Definition of done.** A task is complete only when all of the following hold:

1. It satisfies its acceptance criteria as written in the specification.
2. Tests required by Principle V exist and pass.
3. TypeScript compiles with no errors and lint passes, including the layering rule.
4. Both `th` and `en` locale bundles are complete for any new user-visible text.
5. Any new content conforms to its schema and validates.
6. No previously passing test was weakened, skipped, or deleted to accommodate it.

**Review gate.** Review verifies implementation against specification. Where they disagree, the
specification wins and the discrepancy MUST be reported explicitly rather than resolved by
quietly amending the spec to match the code.

## Governance

This constitution supersedes ad-hoc practice, prior habit, and convenience. Where a proposed
change conflicts with a principle here, the principle prevails unless the constitution is
amended first.

**Amendment procedure.** Amendments MUST be proposed as an explicit change to this file,
including: the principle affected, the rationale, and the migration impact on existing code,
content, specs, and tasks. An amendment is adopted when the project owner approves it. Silent
drift is not amendment.

**Versioning policy.** This document follows semantic versioning:

- **MAJOR** — a principle is removed, or redefined in a way that invalidates existing compliant
  work.
- **MINOR** — a new principle or section is added, or existing guidance is materially expanded.
- **PATCH** — clarification, wording, or formatting that does not change what is required.

**Compliance review.** Every plan MUST pass a Constitution Check before Phase 0 and again after
design. Every review MUST confirm the Definition of Done. Complexity that appears to violate
Principle VI MUST be justified in writing in the plan's Complexity Tracking section, or removed.

**Runtime guidance.** Day-to-day development guidance that is not governance lives in
`CLAUDE.md` at the repository root. `CLAUDE.md` MUST NOT contradict this constitution; if it
does, this document governs and `CLAUDE.md` is corrected.

**Version**: 1.1.0 | **Ratified**: 2026-08-20 | **Last Amended**: 2026-08-20
