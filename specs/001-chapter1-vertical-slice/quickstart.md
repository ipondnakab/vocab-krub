# Quickstart: Chapter 1 Vertical Slice

**Feature**: `001-chapter1-vertical-slice`

Everything you need to run the game, run the tests, and add content without touching engine code.

> The code described here does not exist yet — this is the contract implementation must satisfy.
> Task T001 in `tasks.md` creates the project skeleton that makes these commands real.
>
> **Stack**: Next.js 16 (App Router) + React 19 + Phaser 3.90. React renders text, Phaser renders the
> world. Socket.IO is Stage 2 and is not part of this feature.

---

## Prerequisites

- Node.js 24 LTS
- npm 11+
- [Tiled](https://www.mapeditor.org/) for editing maps (optional — placeholders are generated)

---

## Running

```bash
npm install
npm run dev          # Next dev server → http://localhost:3000
npm run build        # Next production build
npm run start        # Serve the production build
```

The landing page is `/`. The game is `/play`.

## Testing

```bash
npm test             # Full suite — must finish in under 30 seconds (SC-007)
npm run test:watch   # Watch mode while working on rules
npm run test:unit    # Core module tests only
npm run test:content # Schema validation + locale key parity
npm run typecheck    # tsc --noEmit, strict
npm run lint         # Includes the core→Phaser boundary rule (R-011)
```

`npm test` runs entirely in Node. No browser, no canvas, no Phaser, **no React**. If a test needs a
browser to pass, the logic it covers is in the wrong layer — move it into `src/core/`.

React components and Phaser scenes are deliberately untested (Principle V exempts rendering, R-012).
A test asserting a button renders its label proves nothing about whether the battle is correct.

## Development shortcuts

Query parameters on `/play`, active in development only and ignored in production builds:

```text
/play?battle=go-monster     # Jump straight into a battle (US1 independent test)
/play?map=forest            # Load a specific map
/play?challenge=chapter-1   # Jump to the chapter challenge (US6 independent test)
/play?locale=th             # Start in Thai
/play?seed=12345            # Fix the PRNG seed for a reproducible run
```

These exist so each user story can be tested independently, as the spec requires.

## Placeholder assets

```bash
npm run generate:placeholders
```

Writes conforming placeholder art and the three `.tmj` maps per
[contracts/asset-contract.md](./contracts/asset-contract.md) into `public/assets/placeholder/`. Safe
to re-run; it never overwrites real art in `public/assets/`.

Note that UI chrome — dialogue frames, buttons, panels, bars — is **CSS, not art**, so none of it is
generated or needed.

---

## Adding content — no code changes

This is the Principle III test. If any of these needs a source file edit, it is an engine bug.

### Add a vocabulary word

1. Add an entry to `src/content/data/vocabulary.json` with `id`, `word`, `meaning` (both locales),
   `cefr`, `topic`, `difficulty`, `forms`, and `examples`.
2. Add at least one question per derived mastery component to `questions.json` — meaning, one per
   form, and context. Content validation fails if a component has no question, because that component
   could never be mastered.
3. Add the word's id to the chapter's `vocabularyIds` in `chapters.json`.
4. `npm run test:content` to verify.

### Add a monster

1. Add an entry to `monsters.json` referencing an existing `wordId`, with `maxHp`, `attack`,
   `questionPoolIds`, and `rewards`.
2. Place it on a map: in Tiled, add a `monster` object to the `spawns` layer with a `monsterId`
   property. Or edit the `.tmj` directly.
3. Add its id to the chapter's `monsterIds`.
4. Add `public/assets/monsters/<id>.png` and `<id>-overworld.png`, or re-run placeholder generation.

### Add an NPC with a grammar lesson

1. Add the topic to `grammar.json` if it is new.
2. Add dialogue nodes to `dialogue.json`; set `teachesGrammarId` on the node that completes the
   lesson, and list `practiceQuestionIds` for its in-dialogue practice.
3. Add the NPC to `npcs.json` with `dialogueId`, `repeatDialogueId`, and `grammarTopicId`.
4. Place it on the map's `spawns` layer with an `npcId` property.

### Tune balance

Edit `src/content/data/balance.json`. Damage per difficulty tier, HP, XP curve, mastery streak
requirement, review proportion, flee chance, defeat penalty, challenge length and pass threshold all
live here. Nothing in `src/core/`, `src/phaser/`, or `src/components/` contains a tunable literal.

### Add or change UI text

Edit **both** `src/locales/th.json` and `src/locales/en.json`. Missing a key in one locale fails
`npm run test:content` (SC-009). In development an unresolved key renders as `⟪missing:key.name⟫` so
it is impossible to miss visually.

**Never translate the English under test**: a word, its forms, question options, and example
sentences are the material being learned. Only prompts, explanations, meanings, and UI chrome are
localized. The schemas enforce this — a `Localized` object in a target-language field is a validation
error.

---

## Architecture in one diagram

```text
app/  ──▶  src/components/  ──▶  src/runtime/  ──▶  src/core/     ✅  React: all text
app/  ──▶  src/phaser/      ──▶  src/runtime/  ──▶  src/core/     ✅  Phaser: the world

src/components/  ⇄  src/phaser/                                    ❌ fails lint
src/core/        ──▶  phaser | react | next | window               ❌ fails lint
```

Game rules in `src/core/` are plain TypeScript functions over plain data. `src/runtime/` holds current
state and routes intents — **it contains no rules**. Both renderers subscribe to the same store, so
they can never disagree about whose turn it is or how much HP is left.

If you find yourself computing damage, deciding victory, or updating mastery in a component, a scene,
or the store, stop — that belongs in core, where it can be tested.

---

## Where things live

| I want to change… | Go to |
|---|---|
| How much damage a correct answer deals | `src/content/data/balance.json` |
| How mastery is earned or lost | `src/core/mastery/` |
| Which question gets asked next | `src/core/questions/` |
| What happens on victory or defeat | `src/core/battle/`, `src/core/progression/` |
| The question, options, or feedback UI | `src/components/battle/` |
| Monster sprites and attack animation | `src/phaser/scenes/BattleScene.ts` |
| How React and Phaser share state | `src/runtime/` + [contracts/runtime-bridge.md](./contracts/runtime-bridge.md) |
| What an NPC says | `src/content/data/dialogue.json` |
| Where an NPC stands | The map's `spawns` layer in Tiled |
| What is saved | `src/core/save/` + [contracts/save-format.md](./contracts/save-format.md) |
