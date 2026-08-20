# Phase 1 Data Model: Minimap and Map Information

**Feature**: `003-minimap-map-info` | **Date**: 2026-08-20

The useful thing this document says is how little is added: **one authored field, one derived
model, and nothing persisted.**

---

## 1. What is added — authored content

### Chapter — localized map names (R-302, FR-015)

Chapters currently declare `mapIds: string[]`. They gain a parallel record of localized names:

| Field | Type | Rules |
|---|---|---|
| `mapNames` | `Record<string, Localized>` | Keyed by map id. Every id in `mapIds` MUST have an entry, and both `th` and `en` MUST be non-empty (FR-013, FR-015, FR-018). |

Validation added: a map declared in `mapIds` with no entry in `mapNames` fails at load, naming the
file and the map — the same treatment every other missing localized field gets.

**Why a record rather than turning `mapIds` into objects**: `mapIds` is read in several places as a
plain list of ids, including the placeholder generator and the chapter-ordering tests. A parallel
record adds the name without changing the shape everything else already consumes.

---

## 2. What is derived — never stored

`MinimapModel`, computed on read from state the store already holds (R-303):

| Field | Type | Derived from |
|---|---|---|
| `width`, `height` | `number` | `GameMap.width`, `GameMap.height` |
| `blocked` | `boolean[]` | `GameMap.collidesAt(x, y)` over every tile (FR-001) |
| `exits` | `{ x, y, targetMapId }[]` | `GameMap.transitions` (FR-003) |
| `player` | `{ x, y, facing }` | `PlayerState.location` (FR-002) |
| `monsters` | `{ x, y, monsterId }[]` | `WorldState.monsters` — already filtered by `monstersDefeated` (FR-008, FR-009, FR-010) |
| `npcs` | `{ x, y, npcId, lesson }[]` | `WorldState.npcs` + `hasCompletedLesson`; `lesson` is `"none"` when `grammarTopicId` is null, else `"outstanding"` or `"done"` |
| `monstersRemaining` | `number` | `WorldState.monsters.length` (FR-012) |
| `lessonsRemaining` | `number` | count of map NPCs with `lesson === "outstanding"` — an NPC with no lesson (`"none"`) never counts |

`enterMap` already removes defeated monsters when building world state, so "monsters remaining" is
the length of a list that exists — verified against the shipped `worldState.ts` rather than assumed.

A model is produced even for a map with no monsters and no NPCs — empty arrays, zero counts
(FR-007). Changing map rebuilds terrain from scratch, so nothing survives from the previous one
(FR-004).

**Split for memoization**: terrain (`width`, `height`, `blocked`, `exits`) depends only on the map
and is computed once per map. Markers depend on live state and are computed per change. A monster
patrolling every 900 ms must not recompute 300 collision lookups.

---

## 3. What is deliberately NOT added

| | Why not |
|---|---|
| **Persisted state** | FR-016. Everything above derives in microseconds. A stored count goes stale the moment content changes. |
| **Visited-tile tracking** | Fog of war is out of scope. Tracking it would be the feature's only new persisted state, and would need a save migration. |
| **A minimap toggle** | A control and a state for something small enough to leave on. |
| **A minimap image per map** | An asset the owner would have to draw and keep in sync with the `.tmj`. The whole point is that it is derived. |
| **Any battle or question state** | FR-017. |

---

## 4. Relationships

```text
Chapter ──< mapIds ──> GameMap (loaded from .tmj)
   └────< mapNames ──> Localized     ← the only new authored data

MinimapModel  ← derived, never stored
   ├── GameMap        (terrain, exits)
   ├── WorldState     (live monsters, npcs)
   └── PlayerState    (position, monstersDefeated, grammarLearned)
```

---

## 5. Scale notes

| | Now | Design must tolerate |
|---|---|---|
| Maps | 6 | dozens |
| Map size | 20 × 15 | whatever the owner authors |
| Tiles per redraw | 300 | terrain memoized per map, so redraw cost is markers only |

R-305 derives proportions from `width` and `height` rather than assuming 20×15. Every map is that
size today, so a fixed box would look correct and break silently on the first hand-authored map
that is not — which the owner's maps almost certainly will not be.
