# Phase 0 Research: Minimap and Map Information

**Feature**: `003-minimap-map-info` | **Date**: 2026-08-20

Features 001 and 002 settled the stack. Only what a minimap raises is here.

The headline finding is how little this feature has to build: the map model already carries
everything a minimap needs, and it is already in the state renderers read.

---

## R-301: Which renderer draws the minimap

**Decision**: **React**, drawn as an SVG from the core map model. Not a Phaser camera, not a canvas.

**Rationale**: Research R-014 in feature 001 set the boundary as *React draws what the player
reads, Phaser draws what the player watches*. A minimap sits awkwardly between those — it is a
picture of the world, but it is HUD, not the world.

Three things settle it for React:

1. **The data is already there and already framework-free.** `GameMap` exposes `width`, `height`,
   `collidesAt(x, y)`, `transitions`, and `spawns`; `WorldState` carries live monster and NPC
   positions; `PlayerState.location` carries the player. A minimap is a projection of state the
   store already holds — nothing needs to be read back out of Phaser.
2. **It is chrome, and chrome is CSS here.** The HP bars, dialogue frame, journal, and panels are
   all React. A minimap rendered in canvas would be the only HUD element that could not be
   positioned, hidden, or made responsive with the same rules as everything beside it.
3. **FR-006 requires it not to obstruct the battle UI.** That is a layout problem, and layout is
   the DOM's job. Solving it against a Phaser camera viewport means duplicating the responsive
   rules that CSS already applies to every other panel.

**Alternatives rejected**:

- *A second Phaser camera with a small viewport* — the conventional game-engine answer, and it
  renders the real tilemap so it is always accurate. Rejected because it puts a HUD element inside
  the world renderer, where the CSS layout rules that govern every other panel do not reach, and
  because it would need its own hide/show wiring for battle and dialogue.
- *A canvas element drawn manually* — all the drawing work of the Phaser option with none of its
  accuracy benefit.
- *A pre-rendered minimap image per map* — an asset the owner would have to draw and keep in sync
  with the `.tmj`. The whole point is that it is derived.

**Consequence**: the minimap is pure presentation. `src/core` gains one small derivation module
and no new state.

---

## R-302: Where map names live

**Decision**: A localized `name` on each map, authored in `chapters.json` alongside `mapIds`.

Chapter records currently declare `mapIds: string[]`. That becomes a list of objects carrying an
id and a localized name, or gains a parallel `mapNames` record — the schema decision belongs in
Phase 1, but the content home is settled.

**Rationale**: FR-015 requires names be authored, not derived in code. Deriving "castle" → "Castle"
would produce an English-only, capitalisation-guessing name and would silently be untranslatable —
exactly the class of defect the locale audit in feature 001 exists to catch.

Putting names in `chapters.json` rather than a new `maps.json` keeps them beside the chapter that
owns them and avoids a new content file with one field in it.

**Alternatives rejected**:

- *Derive from the map id in code* — untranslatable, and violates FR-015.
- *A new `maps.json`* — a whole content file for one localized string per map, when the chapter
  already declares which maps it owns.
- *Store the name in the `.tmj`* — Tiled supports map properties, but it would put player-facing
  Thai text into a file the owner edits in a map editor, away from every other localized string.

---

## R-303: What "still to do here" is derived from

**Decision**: Derived on read from state that already exists. No new persisted fields (FR-016).

| Shown | Derived from |
|---|---|
| Monsters remaining | `world.monsters`, which `enterMap` already filters by `player.monstersDefeated` |
| Lessons remaining | map NPCs whose `grammarTopicId` is not in `player.grammarLearned` |
| Player position | `player.location` |
| Live entity positions | `world.monsters`, `world.npcs` |

**Rationale**: `enterMap` already removes defeated monsters when building world state (FR-033 of
feature 001), so "monsters remaining on this map" is just the length of a list the store holds.
`hasCompletedLesson` already exists in `src/core/dialogue`.

Deriving rather than storing also means a content edit that adds a monster to a map is reflected
immediately, rather than after whatever would have written the count.

**Alternatives rejected**:

- *Persist per-map completion counters* — new save state for something computable in microseconds,
  and it would go stale the moment content changed.

---

## R-304: Keeping the minimap out of the way

**Decision**: The minimap renders only while `screen === "world"` **and** the player has toggled it
open, and is positioned by the same CSS layout rules as the rest of the HUD.

**Revised 2026-08-20**: originally the minimap was always visible during exploration. The project
owner overruled that — it is hidden by default and toggled with **M** (FR-019). The screen gate
below still applies and is now the second of two conditions rather than the only one.

**Rationale**: FR-006 says it must never obstruct the question panel, the dialogue box, or the
challenge. The simplest way to guarantee that is for it not to exist on those screens — the player
is not navigating during a battle or a conversation, so a navigation aid has nothing to offer.

This mirrors how `WorldHud` already behaves: it returns `null` unless the screen is `world`. The
pattern exists; the minimap follows it rather than inventing a hiding mechanism.

**Testing note**: feature 001 shipped a layout defect where the feedback panel pushed the HP bar
over the monster, and it was invisible to the test suite. Overlap is checked in a browser at the
three viewport widths named in SC-006, not assumed from the CSS.

The analysis pass found that the panels FR-006 originally named — question, dialogue, challenge —
all set a different screen, so the minimap could never have collided with them. The collision that
can actually happen is with the exploration HUD, which shares the world screen and is anchored
top-left. FR-006 was corrected to say so.

---

## R-306: Where the toggle state lives

**Decision**: In the store, as `ui.minimapOpen`, flipped by a `toggle-minimap` intent. **Not**
component state, and **not** persisted.

**Rationale**: three constraints pick this uniquely.

1. **It cannot be component state.** The minimap renders only on the world screen, so the component
   unmounts whenever the player fights, talks, or opens the journal. Component state would reset
   every time — open the map, win a battle, come back, it is closed again. FR-020 forbids exactly
   that.
2. **It cannot be persisted.** FR-016 says the feature adds no save state, and a UI preference is
   not player progress. Recording it would mean a save schema change for a boolean nobody would
   miss on reload.
3. **The store already holds this kind of thing.** `screen` and `screenBefore` are both view state
   living in `GameState`, and every renderer already reads state through one subscription. Adding a
   second mechanism for one boolean would be the inconsistency, not the boolean.

**Where the keypress is handled**: in React, beside the minimap, as a `window` keydown listener —
the same pattern `OptionList` already uses for answering with A–D. Phaser's keyboard handler owns
movement and interaction because those are world actions; showing a HUD panel is not.

**Alternatives rejected**:

- *Phaser `WorldScene` keydown dispatching the intent* — works, and sits beside the existing key
  handling. Rejected because it puts a HUD concern in the world renderer, and the listener would
  keep running on screens where the minimap cannot appear.
- *A `useRef` in a component above the render gate* — survives unmounting, but hides UI state
  outside the store where nothing else can see it, including tests.
- *Persisting the preference* — pleasant, and forbidden by FR-016. Worth revisiting if a settings
  feature ever adds a preferences record; a boolean does not justify one on its own.

---

## R-307: Discoverability

**Decision**: A hint in the exploration HUD, alongside the existing interact hint (FR-022).

**Rationale**: hidden-by-default has one real cost — a player who never presses M never learns the
minimap exists, and the feature is invisible to exactly the people who would benefit most.

The HUD already carries `world.interactHint` ("กด E เพื่อพูดคุย" / "Press E to talk"), so the
pattern, the placement, and the locale keys all exist. A second hint costs one line and removes the
whole risk.

**Alternatives rejected**:

- *A first-time popup* — a modal to explain a corner map is heavier than the feature.
- *Nothing at all* — leaves SC-009 unmeetable, and the answer to "why did nobody use the minimap?"
  would be "nobody knew".

---

## R-305: Proportions

**Decision**: The minimap sizes itself from the map's own aspect ratio, with the tile size derived
from the available width and the map's tile dimensions.

**Rationale**: FR-005 forbids stretching. Today every map is 20×15, so a fixed box would happen to
look right and would quietly break the first time a map is a different shape — and the owner's
hand-authored maps almost certainly will be. Deriving from `map.width` and `map.height` costs one
calculation and removes the trap.

---

## Resolved Unknowns Summary

| ID | Question | Resolution |
|---|---|---|
| R-301 | React or Phaser? | React, as SVG from the core map model — it is HUD, and the data is already framework-free |
| R-302 | Where do map names live? | Authored in `chapters.json`; never derived from the map id |
| R-303 | How is "still to do" computed? | Derived on read from existing state; no new persisted fields |
| R-304 | How does it stay out of the way? | Rendered only on the world screen, like `WorldHud` |
| R-305 | How does it avoid distortion? | Sized from the map's own aspect ratio, not a fixed box |
| R-306 | Where does the toggle state live? | `ui.minimapOpen` in the store — component state would reset on every battle, and persisting it would break FR-016 |
| R-307 | How does anyone find a hidden minimap? | A HUD hint beside the existing interact hint |

**No unresolved NEEDS CLARIFICATION items.** Phase 1 may proceed.
