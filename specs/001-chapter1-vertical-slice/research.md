# Phase 0 Research: Chapter 1 Vertical Slice

**Feature**: `001-chapter1-vertical-slice` | **Date**: 2026-08-20

**Revised 2026-08-20** for the Next.js + React + Phaser stack decision. R-001 amended; R-013 through
R-017 added. Everything else stood up to the stack change unchanged — which is itself the strongest
evidence that Principle II's rules/rendering split was the right structural bet.

Every unknown that would have blocked design is resolved here. Each entry records what was decided,
why, and what was rejected.

---

## R-001: Phaser 3 or Phaser 4

**Decision**: Phaser **3.90.0**.

**Context**: The concept document specifies Phaser 3. As of today Phaser 4.2.1 is the `latest` tag on
npm, and Phaser 3.90.0 is the final v3 line.

**Rationale**: The concept explicitly names Phaser 3, and this is a rendering-adapter layer only —
under Principle II, the engine choice touches `src/phaser/` and nothing else. Phaser 3 has a decade of
tutorials, tilemap examples, and Stack Overflow answers behind it, which matters for a first game
project. Phaser 4's rendering rewrite brings no benefit to a 2D tile-based JRPG at this scale.

**Alternatives rejected**:

- *Phaser 4.2.1* — newer, but the API surface changed and community material has not caught up. It
  would trade documented paths for novelty on the one layer where novelty has no payoff.
- *Excalibur / Kaboom / bare canvas* — the concept specified Phaser and there is no reason to argue.

**Under Next.js**: Phaser touches `window` at module scope, so it must be imported through
`next/dynamic` with `ssr: false` and never referenced from a server component. See R-013.

**Note for the owner**: If Phaser 4 is preferred, say so before the setup task lands. Because rules
never import Phaser, the switch is confined to `src/phaser/` — genuinely cheap, but cheapest before
those files exist.

---

## R-002: TypeScript version

**Decision**: TypeScript **5.9.3**.

**Context**: TypeScript 7.0.2 (the native Go compiler port) is now `latest` on npm.

**Rationale**: TypeScript 7 is a compiler rewrite whose ecosystem support — typed ESLint rules, Vite
plugins, Phaser's shipped type definitions — is still stabilizing. This project's value is in game
rules, not in being an early adopter of a build toolchain. 5.9.3 is the last 5.x and is what every
dependency here is tested against.

**Alternatives rejected**:

- *TypeScript 7.0.2* — the compile-speed win is irrelevant on a codebase this size, and toolchain
  breakage would cost more than it saves.

**Revisit when**: typescript-eslint ships stable TS 7 support. The upgrade is a version bump plus a
lint config check; nothing in the source depends on compiler internals.

---

## R-003: Content format and validation

**Decision**: JSON data files in `src/content/data/`, validated by **Zod 4** schemas in
`src/content/schemas/`, with schemas as the single source of truth for both runtime validation and
static types via `z.infer`.

**Rationale**: Principle III demands content that a non-engineer can edit and that fails loudly when
wrong. JSON is universally editable and diffs cleanly in git. Zod gives one definition that produces
both the runtime validator and the TypeScript type, so a schema and its type cannot drift apart. Zod's
error objects carry a field path, which is exactly what FR-050's "name the file and the field"
requires — the loader wraps a Zod issue as `vocabulary.json → words[7].forms[2].role: expected string`.

**Alternatives rejected**:

- *TypeScript files exporting typed objects* — content becomes code, violating Principle III, and a
  content author would need to understand TypeScript syntax and the build.
- *YAML* — friendlier to write, but adds a parser dependency and its implicit type coercion (the
  Norway problem: `no` becoming `false`) is a real hazard in a file full of English words.
- *JSON Schema with Ajv* — equivalent validation, but requires maintaining types separately from
  schemas, which is the drift Zod eliminates.

**Consequence**: Content validation runs both as a build-time test (`tests/content/`) and at game load.
Authors get the error in CI, players never get a half-loaded world.

---

## R-004: Question selection algorithm

**Decision**: Weighted selection from an eligible pool, computed fresh each turn.

The pool for a turn is built by filtering all questions to those that are:

1. attached to the monster's word, or to a word the player has already encountered (review pool);
2. not dependent on a grammar topic the player has not yet learned (FR-018);
3. not the question asked on the immediately preceding turn (FR-013).

Each eligible question is then weighted:

- **Base weight** by source: the monster's own word is weighted heavily; review words share the
  remainder according to `balance.questions.reviewProportion`.
- **Component multiplier**: a question exercising an unmastered component of the monster's word gets
  the highest multiplier; a component mid-streak gets a middling one; an already-mastered component
  gets the lowest non-zero weight, so review still happens but does not dominate.
- **Recency penalty**: questions already asked this battle are down-weighted rather than excluded, so
  a small pool degrades gracefully instead of running dry.

**Rationale**: FR-019 requires bias toward unmastered components, FR-020 requires review at a
configurable proportion, and the edge cases require correct behaviour when the pool is smaller than
the battle is long. A weighted draw satisfies all three with one mechanism. Weights come from
`balance.json`, never from code, per Principle III.

**Alternatives rejected**:

- *Pre-shuffled fixed queue built at battle start* — cannot react to mastery earned mid-battle, so a
  component mastered on turn 2 would still be drilled on turn 6.
- *Strict round-robin over components* — predictable, and a player quickly learns the pattern rather
  than the words.
- *Pure uniform random* — violates FR-019 and wastes turns on already-mastered material.

**Edge behaviour**: If the eligible pool is empty after filtering — the "monster has no askable
questions" edge case — content validation has already failed at load time, so this is unreachable at
runtime. The selector still throws a named error rather than returning `undefined`, so a content bug
surfaces as a clear message and not a blank battle screen.

---

## R-005: Mastery promotion and demotion

**Decision**: Per-component consecutive-correct streaks.

- Each mastery component holds a `streak` counter and a derived `mastered` flag.
- A correct answer on that component increments `streak`.
- `mastered` is true when `streak >= balance.mastery.streakRequired` (default **2**).
- An incorrect answer on an unmastered component resets `streak` to `0`.
- An incorrect answer on a *mastered* component sets `streak` to `streakRequired - 1`, demoting it —
  one correct review answer restores it.
- Word mastery percentage = mastered components ÷ total components. A word is MASTERED at 100%.

**Rationale**: Principle IV forbids treating one lucky four-option guess as knowledge; requiring two
consecutive correct answers drops the odds of mastering by chance from 25% to about 6% per component,
and across a whole word's components it becomes negligible. Demoting rather than zeroing satisfies
FR-025's "never reset to zero" while still creating the review pressure that makes revisited words
meaningful. The demotion floor is deliberately one correct answer away from restoration so that a
single slip on a known word is a speed bump, not a punishment.

**Alternatives rejected**:

- *Ratio-based (correct ÷ attempts ≥ threshold)* — a player can farm the ratio with easy repeats, and
  early mistakes haunt a word permanently.
- *Single correct answer masters* — fails Principle IV outright.
- *Full SM-2 spaced repetition* — genuinely better long-term pedagogy, but it schedules across
  sessions and days, which the MVP cannot evaluate in one 90-minute playthrough. Explicitly out of
  scope; the streak model is designed so an interval field can be added later without reworking the
  component structure.

---

## R-006: Difficulty-to-damage model

**Decision**: A question's `difficulty` tier is an explicit field in content, decoupled from its
level. Damage resolves as:

```text
damage = balance.damage.byDifficulty[tier] * weapon.damageMultiplier
```

with tiers `easy | medium | hard | expert` and default values 10 / 20 / 30 / 50 from the concept
document, all in `balance.json`.

**Rationale**: The concept maps damage to difficulty, and separately defines six question *levels*.
These are different axes: a Level 1 meaning question about a rare word can be harder than a Level 3
form question about `go`. Binding damage to level would force content authors to misclassify a
question's type to get the damage they want. An explicit tier lets a designer say what a question is
*and* what it is worth, independently.

Monster HP is authored against these tiers so a fight lasts a designed number of turns: a monster with
100 HP falls in roughly 4–5 medium answers.

**Alternatives rejected**:

- *Damage derived from question level* — conflates two independent axes, as above.
- *Damage scaled by player level* — makes late-chapter fights trivial and undermines the premise that
  knowledge, not grinding, is the weapon.

---

## R-007: Randomness and determinism

**Decision**: All randomness in `src/core/` flows through an injected seeded PRNG. No core module
calls `Math.random()` directly.

**Rationale**: Question selection, option shuffling (FR-021), flee resolution (FR-011), and item drops
are all random and all state-changing, so Principle V requires them to be tested. A test seeds the
PRNG and asserts exact outcomes; production seeds it from the clock. This costs one constructor
parameter and makes otherwise-untestable rules trivially testable. It also makes any reported bug
reproducible from its seed.

**Alternatives rejected**:

- *`Math.random()` with statistical assertions* — flaky tests, and cannot assert a specific outcome.
- *Mocking `Math.random` globally in tests* — works, but couples every test to a global and breaks the
  moment two randomized calls happen in one turn.

---

## R-008: Maps and tilemaps

**Decision**: Tiled (`.tmj` JSON export) loaded by Phaser's tilemap API. Three maps — village, forest,
cave. Collision is driven by a `collides` property on tiles, not by a hand-maintained coordinate list.
Object layers carry NPC spawns, monster spawns, and map transition points.

**Rationale**: The concept specifies Tiled, Phaser 3 reads its JSON natively, and object layers keep
entity placement in the map file — which is content — rather than in scene code, satisfying Principle
III. A designer can move an NPC without an engineer.

**Alternatives rejected**:

- *Hand-authored JSON tile arrays* — unworkable past a single screen.
- *Procedural generation* — wrong for a story-driven chapter with authored NPC placement.

**Asset dependency**: Tilesets are owner-supplied. Until they arrive, a generator script produces
conforming placeholder tilesets and three simple maps against the documented asset contract, so
movement, collision, and transitions are all buildable and testable now. See
[contracts/asset-contract.md](./contracts/asset-contract.md).

---

## R-009: Localization

**Decision**: A flat key-value JSON bundle per locale (`src/locales/th.json`, `en.json`), resolved
through a `t(key, params)` function in `src/core/i18n/`. Content data files hold localized fields as
`{ "th": "...", "en": "..." }` objects rather than referencing bundle keys.

**Rationale**: Two different kinds of text need two different treatments. UI chrome ("Attack", "Flee",
"Level Up") is stable and belongs in a bundle. Content text (a word's meaning, an NPC's line, a
question's explanation) belongs beside the content it describes, so a content author edits one file
and sees both languages together — splitting them into a bundle would make authoring a word require
edits in three files.

A missing key renders as a loud `⟪missing:key.name⟫` marker in development builds and fails the
locale key-parity test in CI (SC-009), satisfying FR-051's "never render blank".

**Critical rule**: The English *under test* is not translatable. A question's prompt and explanation
localize; the word `went`, the sentence `I ___ to school yesterday`, and every answer option do not.
Schemas enforce this by typing target-language fields as plain strings and instructional fields as
localized objects — so the type system makes the mistake unrepresentable rather than merely
discouraged.

**Alternatives rejected**:

- *i18next* — a capable library, but its features (pluralization rules, backends, namespaces, language
  detection) are all unneeded here, and Principle VI rejects dependencies bought for imagined needs.
- *All strings in bundles including content* — makes adding one vocabulary word a three-file edit.

---

## R-010: Save format and versioning

**Decision**: A single JSON document under one `localStorage` key, carrying an integer
`schemaVersion` from its first write. Load validates against a Zod schema; a version mismatch or a
validation failure is surfaced to the player as an unloadable save with an offer to start fresh
(FR-055), never a crash and never a silent partial load.

**Rationale**: FR-054 requires lossless round-trips and Principle VII requires a migration path to
exist before it is needed. Reusing Zod for the save schema means the same "name the field" error
quality applies to corrupt saves. One key rather than many avoids partially-written state if a write
is interrupted.

**Alternatives rejected**:

- *IndexedDB* — the async API complicates every call site for a payload measured in kilobytes.
- *Unversioned saves* — guarantees a painful day the first time the shape changes.
- *Multiple keys per subsystem* — invites inconsistent state across keys.

**Under Next.js**: `localStorage` does not exist during server rendering. The repository is
instantiated only inside the client-mounted game, never at module scope, and `src/core/` never
references it directly — it only holds the interface. This is the same rule that already kept core
testable in Node, now doing double duty for SSR.

**Storage unavailable** (private browsing, quota exceeded, storage disabled): the repository probes
writability on init and reports failure through its interface. The game runs and warns the player that
progress will not persist (FR-056) rather than failing to start.

---

## R-011: Enforcing the layering rule

**Decision**: An ESLint `no-restricted-imports` override scoped to `src/core/**` that forbids
`phaser`, any `../scenes/*` path, and DOM globals, plus a matching rule keeping `src/content/**` free
of Phaser. Lint runs in CI and blocks the build.

**Rationale**: The constitution states the dependency rule MUST be enforced by lint, not convention.
Principle II is the highest-leverage structural rule in the project and the easiest to erode by
accident — one `import Phaser` added for a quick tween inside a rules file and the whole test strategy
degrades. A lint rule catches it in the editor.

**Alternatives rejected**:

- *Convention plus code review* — the constitution explicitly rejects this.
- *Separate npm workspace packages per layer* — real enforcement, but adds a monorepo toolchain to a
  single-package game. Rejected under Principle VI.

---

## R-012: Testing strategy

**Decision**: Vitest in a Node environment. Three test tiers matching the source layout:

- `tests/unit/` — one file per core module, covering the normal path, the failure path, and every
  boundary named in the spec's Edge Cases.
- `tests/integration/` — cross-module flows driven entirely through the core API with no rendering: a
  full battle to victory, a full battle to defeat, a chapter completed end to end, and a save/load
  round-trip.
- `tests/content/` — every content file validated against its schema, plus locale key parity between
  `th` and `en`, plus the FR-022 checks (no distractor that is also correct, no dangling references).

No Phaser scene and no React component is unit-tested. Rendering, animation, and asset loading are
validated by playing the game, exactly as Principle V exempts. The temptation with React is to reach
for Testing Library because it is easy — resist it: a test asserting that a button renders its label
proves nothing about whether the battle is correct, and it costs suite time that SC-007 does not have.
Every assertion worth making about a battle is already available against `src/core/` in microseconds.

**Rationale**: SC-006 demands 100% coverage of state-changing rules and SC-007 caps the suite at 30
seconds. Both are achievable only because core never touches a browser — a Node-only suite over pure
functions runs in milliseconds. Content tests are what let a designer add a word and find out
immediately that they mistyped a grammar topic id.

**Alternatives rejected**:

- *Playwright end-to-end tests of the running game* — slow, flaky, and would blow the 30-second budget
  on its own. Reconsider after the MVP validates, for regression safety on shipped content.
- *Testing scenes with a headless canvas* — high cost, low value, and it tests the adapter rather than
  the rules.

---

## R-013: Integrating Phaser into Next.js

**Decision**: A single Next.js 16 App Router application. The game lives at `/play`, which renders a
`GameCanvas` client component imported via `next/dynamic` with `ssr: false`. Phaser is instantiated in
an effect on mount and destroyed on unmount.

**Rationale**: Phaser reads `window` and `navigator` at module evaluation time, so any import path
that reaches a server component crashes the build. `ssr: false` on a single leaf component contains
that hazard to one file. Everything else in the app — landing page, and later profile and settings —
renders normally on the server and gets Next's routing, font optimization, and build pipeline for
free.

Strict mode double-invokes effects in development, which would create two Phaser instances over one
canvas. The mount effect guards with a ref and destroys cleanly on unmount, and this is called out in
its task because it is the classic way this integration breaks.

**Alternatives rejected**:

- *Separate Vite app for the game, Next only for marketing* — two build systems, two dev servers, and
  a hard boundary exactly where the player crosses from the site into the game.
- *Static export of a Phaser bundle embedded in an iframe* — isolates the game from the React UI,
  which defeats the entire point of the chosen UI boundary (R-014).
- *Pages Router* — App Router is the current default and gives simpler layout-scoped font and locale
  providers.

---

## R-014: The React / Phaser UI boundary

**Decision**: React DOM renders every piece of text the player reads. Phaser renders everything the
player watches.

| React (DOM) | Phaser (canvas) |
|---|---|
| Question prompt, answer options | Tilemap, terrain, decoration |
| Wrong-answer feedback and explanation | Player and NPC sprites, walk cycles |
| Dialogue box, portrait, NPC lines | Monster sprites, idle/hurt/attack/restored frames |
| HP bars, mastery stars, HUD | Attack effects, damage flashes, camera |
| Journal, inventory, menus, locale switch | Scene transitions, map rendering |

**Rationale**: Three reasons, in order of weight.

1. **Thai typography.** This is decisive. Thai stacks combining vowels above and tone marks above
   those, plus vowels below the base glyph. DOM text engines handle that correctly with any font that
   carries the marks. Canvas bitmap text in Phaser positions them as spacing characters or drops them,
   and the workarounds are fragile. The game is bilingual from the first commit and text-heavy in both
   languages, so this alone settles it.
2. **Text-heavy UI is what DOM is for.** Wrapping, reflow, scaling, selection, and accessibility come
   free. Reimplementing a paginated dialogue box with wrapping in Phaser is real work that buys
   nothing.
3. **UI chrome becomes CSS instead of art.** The dialogue frame, option buttons, panels, and HP bars
   drop out of the asset contract entirely, which is a meaningful reduction in what the owner has to
   draw before the game looks finished.

**The risk, and the mitigation**: HTML defaults make things look like a web form, and a web form is
exactly what Principle I forbids this game from becoming. Mitigation is explicit: the React layer is
styled as an RPG interface — pixel-bordered panels, the game's palette, no default form controls, no
system fonts — and the UI tasks say so rather than leaving it to taste.

**Alternatives rejected**:

- *Phaser renders everything* — the concept document's original position, and defensible for a purely
  visual game. Rejected on Thai rendering alone.
- *React for menus, Phaser for battle text* — splits the hardest typography problem across both
  systems, so the Thai work still has to be done in canvas. Worst of both.

---

## R-015: Sharing state between React and Phaser

**Decision**: A small subscribable store in `src/runtime/`. It holds current game state, exposes
`subscribe`/`getSnapshot`, and accepts typed intents that it forwards into `src/core/`. React binds
with `useSyncExternalStore`. Phaser subscribes directly in scene create and unsubscribes on shutdown.
The store contains **no rules** — it dispatches to core and stores what core returns.

**Rationale**: Both renderers must agree, always, about whose turn it is and how much HP each side
has. Two independent copies of that state is a desync bug waiting to happen, and it would surface as
an HP bar that disagrees with the sprite — cheap to prevent, miserable to debug. One source of truth
with two subscribers is the minimum mechanism that makes disagreement impossible.

`useSyncExternalStore` is React's built-in answer for exactly this shape (an external mutable source
feeding React), so it needs no library.

**Alternatives rejected**:

- *Zustand or Redux* — would work, but adds a dependency for a store this small. Principle VI: two
  consumers justify the pattern, not the package.
- *Phaser's event emitter as the shared bus* — puts React's state lifetime inside Phaser's, so React
  can no longer render before or after the game instance exists.
- *React owns state and passes props into Phaser* — couples Phaser's lifecycle to React's render
  cycle and makes every scene update a prop diff.
- *Each renderer keeps its own copy* — the desync bug described above.

**The rule that keeps this honest**: if a calculation appears in `src/runtime/`, it is in the wrong
place. The bridge routes; core decides. This is stated in the constitution and checked in review.

---

## R-016: Fonts and Thai typography

**Decision**: Load fonts through `next/font` in the root layout. Two faces: a display face for
headings and RPG chrome, and a text face with **complete Thai coverage** (U+0E00–U+0E7F including
combining vowels and tone marks) for all body and question text.

**Rationale**: `next/font` self-hosts and preloads, so there is no external request and no layout
shift — which matters because a font swap mid-battle is jarring. Since UI is DOM (R-014), Thai
rendering is the browser's job and it does it correctly, provided the font actually carries the marks.
Many pixel fonts do not, which is why this is a decision and not an afterthought.

If no pixel font with Thai coverage is acceptable to the owner, a clean Thai-capable text face is used
for content and the pixel face is reserved for Latin headings and numbers. Broken glyphs are never an
acceptable trade for style.

**Verification**: a task checks rendering of Thai strings that exercise stacked marks specifically,
not just any Thai text — the failure mode is subtle and only shows on words that stack.

---

## R-017: Socket.IO and the Stage 2 open world

**Decision**: **Nothing.** No socket dependency, no client, no presence types, no multiplayer config
keys, no placeholder module. Stage 2 is a separate feature with its own specification, written after
the Stage 1 playtest.

**Rationale**: The owner's design has two stages — a single-player learning campaign, then a shared
open world unlocked by completing all mission quests. Stage 1 is what this feature builds and what the
MVP validates. Constitution Principle VI forbids placeholder architecture for unspecified features,
and the Product Shape section makes the prohibition explicit for Stage 2 in particular.

The temptation will be to "just add the socket client now so we don't have to retrofit it." That
reasoning is exactly what Principle VI exists to refuse. Concretely, the retrofit cost is near zero
because of how Stage 1 is already built: rules are pure functions over state, and state already
serializes losslessly for saves (FR-054). A shared world needs to transmit state; the serialization
that makes saves work is the same serialization that makes transmission work. Building the transport
before knowing what it carries is what would be expensive.

**When Stage 2 is specified**, these questions will need answers, and none of them can be answered
usefully today: is battle resolution client- or server-authoritative; what does the shared world
contain besides other players; how does Principle IV survive a world where players can see each
other's answers; and is the campaign completion gate per-account or per-device.

**Recorded for that spec**: the entry condition is completing all mission quests, and per the
constitution it must not be bypassable. That is the one Stage 2 decision already made.

## Resolved Unknowns Summary

| ID | Question | Resolution |
|---|---|---|
| R-001 | Phaser 3 or 4? | Phaser 3.90.0, client-only under Next.js; confined to `src/phaser/` |
| R-002 | Which TypeScript? | 5.9.3, not the TS 7 native port |
| R-003 | Content format? | JSON validated by Zod, schemas as the source of both types and validation |
| R-004 | How are questions chosen? | Weighted draw biased to unmastered components, configurable review proportion |
| R-005 | How is mastery earned and lost? | Per-component consecutive-correct streak, default 2; demote on miss, never zero |
| R-006 | How does difficulty become damage? | Explicit difficulty tier per question × weapon multiplier, all from balance config |
| R-007 | How is randomness testable? | Injected seeded PRNG; core never calls `Math.random()` |
| R-008 | How are maps built? | Tiled `.tmj` with object layers for spawns and transitions |
| R-009 | How does bilingual content work? | UI in locale bundles, content localized inline; target English never translated |
| R-010 | How are saves stored? | One versioned JSON document in `localStorage`, client-only, behind `SaveRepository` |
| R-011 | How is the layer boundary enforced? | ESLint boundary rules across core, runtime, phaser, and components |
| R-012 | What gets tested? | Node-only Vitest; scenes **and React components** exempt as rendering |
| R-013 | How does Phaser fit into Next.js? | App Router, `/play` route, `next/dynamic` with `ssr: false`, guarded mount |
| R-014 | Which renderer draws what? | React draws all text; Phaser draws the world. Decided by Thai typography |
| R-015 | How do the two renderers share state? | One subscribable store in `src/runtime/`; `useSyncExternalStore` for React |
| R-016 | How does Thai text render correctly? | `next/font` with verified Thai mark coverage; DOM does the layout |
| R-017 | What about Socket.IO and the open world? | Stage 2. Nothing built, stubbed, or scaffolded now |

**No unresolved NEEDS CLARIFICATION items remain.** Phase 1 may proceed.
