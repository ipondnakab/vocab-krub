# Implementation Plan: Minimap and Map Information

**Branch**: `003-minimap-map-info` | **Date**: 2026-08-20 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-minimap-map-info/spec.md`

## Summary

Show the player the shape of the map they are on, where they are on it, where its exits lead, and
what they have not finished there.

The plan is short because the feature is mostly already paid for. `GameMap` carries dimensions,
collision, exits, and spawns; `WorldState` carries live entity positions; `PlayerState` carries the
player's tile. A minimap is a projection of state the store already holds, so this adds one
derivation module in core, one React component, and one localized field in content.

**No new persisted state, no new mechanic, no new dependency.** If this plan turns out to be mostly
CSS and one pure function, that is the correct outcome rather than an underdelivery.

## Technical Context

**Language/Version**: Unchanged — TypeScript 5.9.3 strict, Node.js 24 LTS

**Primary Dependencies**: Unchanged — Next.js 16, React 19, Phaser 3.90.0, Zod 4. **No new
dependency.** The minimap is inline SVG; no charting or drawing library is involved.

**Storage**: Unchanged. **No save schema change** — FR-016 forbids new persisted state, and R-303
derives everything on read.

**Testing**: Vitest, Node environment. The derivation module is pure and fully testable; the React
component is rendering and exempt under Principle V, so it is verified in a browser instead.

**Target Platform**: Unchanged. Verified at 390 px, 820 px, and 1280 px (SC-006).

**Performance Goals**: The minimap redraws on every store change during exploration, including the
patrol tick every 900 ms. At 20×15 that is 300 tiles — trivial — but the derivation is memoized on
map identity so a monster moving does not recompute the terrain.

**Constraints**: No new question type, no new battle mechanic (FR-017). The suite must still finish
under 30 seconds (SC-005).

**Scale/Scope**: 6 maps today, 20×15 each. The design must not assume that size — R-305 derives
proportions rather than fixing a box, because the owner's hand-authored maps will differ.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

Evaluated against Vocab Krub Constitution **v1.1.0**.

| Principle | Gate | Status |
|---|---|---|
| I. Game First, Quiz Never | Is this something a player would want in a JRPG? Does it drift toward a dashboard? | **PASS** — a corner minimap is standard JRPG furniture. The risk is the opposite of a quiz here: a HUD that grows into a dashboard. FR-012 keeps "what remains" to two counts rather than a statistics panel, and the minimap hides entirely outside exploration (R-304). |
| II. Separation of Engine, Rules, and Rendering | Does anything leak across the boundary? | **PASS** — the derivation lives in `src/core/world/` and imports nothing. The component reads it through the store like every other panel. Notably it does **not** read back out of Phaser: R-301 chose React precisely because the data is already framework-free. |
| III. Content Is Data, Not Code | Are map names authored? | **PASS** — FR-015 and R-302 put localized map names in `chapters.json`. Deriving "castle" → "Castle" in code would be English-only and untranslatable, which is the defect class the locale audit exists to catch. |
| IV. Pedagogical Honesty | Does this reveal answers or bypass learning? | **PASS** — it shows where monsters are, which the player can already see by walking. It reveals nothing about any question, and grants no advantage in a battle. |
| V. Test Every Rule That Changes Player State | Are new state-changing rules tested? | **PASS by absence** — this feature changes no player state at all (FR-016). The derivation is pure and gets tests; the rendering is exempt as rendering and is verified in a browser. |
| VI. Vertical Slice Discipline | Any speculative abstraction? Any building ahead? | **PASS** — no toggle state, no fog of war, no waypoints, no world map. Fog of war is recorded in the spec as future scope rather than half-built. |
| VII. Preserve Working Behavior | Does anything existing change? | **PASS** — additive. The one existing thing touched is the chapter schema gaining map names, which is backward-compatible content. |
| Product Shape: Two Stages | Is Stage 2 kept out? | **PASS** — nothing here is multiplayer or networked. A shared-world minimap showing other players would be a Stage 2 feature and is not built, stubbed, or configured. |

**Result**: All gates pass. Proceed to Phase 0.

**Post-Phase-1 re-check**: All gates still pass. Phase 1 added no persisted state and no rule
outside `src/core/`.

## Project Structure

### Documentation (this feature)

```text
specs/003-minimap-map-info/
├── spec.md              # Feature specification — 18 FRs, 8 SCs, 0 open clarifications
├── plan.md              # This file
├── research.md          # Phase 0 — R-301…R-305
├── data-model.md        # Phase 1 — what is derived, and the one authored addition
├── quickstart.md        # Phase 1 — how to run and verify it
├── contracts/
│   └── minimap-model.md # The shape the renderer consumes
├── checklists/
│   └── requirements.md  # 16/16
└── tasks.md             # Phase 2 output (/speckit-tasks — not created here)
```

### Source Code (repository root)

Small, and listing only what changes:

```text
src/
├── core/world/
│   └── minimap.ts               # NEW — pure derivation: terrain, exits, markers, remaining counts
│
├── content/
│   ├── schemas/chapters.ts      # EXTENDED — localized map names (R-302)
│   └── data/chapters.json       # EXTENDED — names for the six existing maps
│
├── components/hud/
│   ├── Minimap.tsx              # NEW — inline SVG over the derived model
│   └── MapInfo.tsx              # NEW — map name, chapter title, what remains
│
└── locales/{th,en}.json         # EXTENDED — labels for the counts

tests/
├── unit/minimap.test.ts         # NEW — the derivation, including the edge cases in the spec
└── content/schemas.test.ts      # EXTENDED — every map has a name in both locales
```

**Structure Decision**: No new layer and no new dependency. The minimap follows the pattern
`WorldHud` already established — a React component under `src/components/hud/` that reads the store
and returns `null` outside its screen. The only genuinely new thing is one pure module in
`src/core/world/`, which is where map logic already lives.

## Phase Outputs

- **Phase 0** — [research.md](./research.md): R-301 through R-305. R-303's claims were verified
  against the shipped code rather than assumed.
- **Phase 1** — [data-model.md](./data-model.md), [contracts/minimap-model.md](./contracts/minimap-model.md),
  [quickstart.md](./quickstart.md).
- **Phase 2** — `tasks.md`, produced by `/speckit-tasks`.

## Complexity Tracking

> Filled only where the Constitution Check surfaced something needing justification.

*No violations.* This feature adds no abstraction, no state, no dependency, and no mechanic. The
only new module is a pure function over data the game already loads.

Worth recording explicitly because it is unusual: nothing here needed justifying, and the reason is
that features 001 and 002 already put the map model in core and framework-free. The cost of that
decision was paid then; this is the first feature to collect on it.
