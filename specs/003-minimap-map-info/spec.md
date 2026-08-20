# Feature Specification: Minimap and Map Information

**Feature Branch**: `003-minimap-map-info`

**Created**: 2026-08-20

**Status**: Draft — no open clarifications

**Input**: User description: "I need to add minimap and map information."

## Overview

The player can see the shape of the map they are standing on, where they are on it, where its exits
lead, and what they have not finished there yet.

Two maps in, the world is six maps across two chapters connected end to end. A player who steps
away and comes back has no way to answer *"where am I, and what did I still have to do here?"*
without walking the whole map again. That is the gap this closes.

**Scope note**: this is a navigation and orientation aid, not a new game system. It adds no
mechanic, no question type, and no player state. Nearly all of it is presentation over map data
the game already loads.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - See where I am and where the exits are (Priority: P1)

While walking around, the player can glance at a small map in the corner and immediately see the
shape of the area, their own position on it, and which edges lead somewhere else.

**Why this priority**: Orientation is the whole point. Everything else in this feature is detail
layered on top of knowing where you are.

**Independent Test**: Load any map, look at the minimap, walk three tiles, and confirm the marker
moves to match.

**Acceptance Scenarios**:

1. **Given** the player is on any map, **When** they look at the minimap, **Then** the walkable
   area, the blocked area, and their own position are all distinguishable at a glance.
2. **Given** the player moves one tile, **When** the move completes, **Then** the marker on the
   minimap moves by one corresponding step.
3. **Given** the map has exits, **When** the player looks at the minimap, **Then** each exit is
   marked at its position on the map edge.
4. **Given** the player enters a different map, **When** the new map loads, **Then** the minimap
   redraws for the new map without stale tiles from the previous one.
5. **Given** the player is in a battle or a conversation, **When** they look at the screen,
   **Then** the minimap does not obstruct the question or the dialogue.

---

### User Story 2 - See what is left to do here (Priority: P2)

The minimap shows the things still worth walking to: monsters not yet restored, and NPCs whose
lesson the player has not finished. Once a word is restored or a lesson is done, its marker stops
asking for attention.

**Why this priority**: This is what turns a map into a checklist the player can act on, and it is
the thing a returning player most needs. It ranks below orientation because a marker on a map you
cannot locate yourself on is not useful.

**Independent Test**: Load a map with monsters and NPCs, confirm both appear as distinct markers,
defeat a monster, and confirm its marker is gone.

**Acceptance Scenarios**:

1. **Given** a map with monsters the player has not defeated, **When** they look at the minimap,
   **Then** each is marked, distinguishable from NPC markers.
2. **Given** the player restores a word, **When** they return to the map view, **Then** that
   monster's marker is gone.
3. **Given** an NPC whose lesson the player has completed, **When** they look at the minimap,
   **Then** that NPC is shown as finished rather than as outstanding.
4. **Given** an NPC who has no lesson to give at all, **When** they look at the minimap, **Then**
   that NPC is shown as neither outstanding nor finished, and is not counted in lessons left.
5. **Given** monsters patrol, **When** they move, **Then** their markers move with them.
6. **Given** a map where everything is done, **When** the player looks at the minimap, **Then**
   nothing on it is flagged as outstanding.

---

### User Story 3 - Know which place this is (Priority: P3)

Alongside the minimap, the player can see the name of the map they are in and which chapter it
belongs to, in their own language.

**Why this priority**: Useful context, and cheap once the minimap exists. It ranks last because a
player can orient themselves from the map shape alone.

**Acceptance Scenarios**:

1. **Given** the player is on any map, **When** they look at the map information, **Then** the
   map's name and its chapter's title are shown in the player's language.
2. **Given** the player switches language, **When** the interface updates, **Then** the map and
   chapter names change with it.
3. **Given** a map that content has not given a name, **When** it is displayed, **Then** something
   readable is shown rather than a blank or an internal id.

---

### Edge Cases

- What happens on a map with no monsters or NPCs at all? The minimap must still render.
- What happens when the minimap's aspect ratio differs from the map's? It must not stretch the map
  into a misleading shape.
- What happens on a narrow viewport where the minimap would cover the battle UI?
- What happens if a monster patrols behind the player's own marker? One must remain visible.
- What happens when a map is much larger than the current 20×15 — does the minimap still fit?
- What happens during the story opening, before any map has loaded?

## Requirements *(mandatory)*

### Functional Requirements — Minimap

- **FR-001**: The system MUST display a minimap of the current map showing walkable and blocked
  areas distinguishably.
- **FR-002**: The system MUST mark the player's current position, and MUST update it within one
  step of the player moving.
- **FR-003**: The system MUST mark every exit at its position on the map.
- **FR-004**: The system MUST redraw the minimap when the player changes map, retaining nothing
  from the previous one.
- **FR-005**: The minimap MUST preserve the map's proportions rather than stretching it to fit.
- **FR-006**: The minimap MUST NOT obstruct the question panel, the dialogue box, or the chapter
  challenge at any supported viewport size.
- **FR-007**: The minimap MUST render for a map that contains no monsters and no NPCs.

### Functional Requirements — What remains

- **FR-008**: The system MUST mark monsters the player has not yet defeated, distinguishably from
  NPCs.
- **FR-009**: The system MUST stop marking a monster once the player has restored its word.
- **FR-010**: The system MUST move a monster's marker as that monster patrols.
- **FR-011**: The system MUST distinguish, for every NPC, whether they have no lesson to give, a
  lesson outstanding, or a lesson already complete.
- **FR-012**: The system MUST show a summary of what remains on the current map — monsters left and
  lessons left — as counts. An NPC with no lesson to give MUST NOT count toward lessons left.

### Functional Requirements — Map information

- **FR-013**: The system MUST display the current map's name and its chapter's title, localized.
- **FR-014**: The system MUST fall back to something readable when a map has no authored name,
  never rendering a blank or a raw identifier.
- **FR-015**: Map names MUST be authored content, not derived from map file names in code.

### Functional Requirements — Constraints

- **FR-016**: The feature MUST add no new persisted player state.
- **FR-017**: The feature MUST introduce no new question type and no new battle mechanic.
- **FR-018**: All user-visible text MUST resolve through the locale layer in both Thai and English.

### Key Entities *(include if feature involves data)*

- **Map Name**: New authored content — a localized name per map. The only new content this feature
  introduces.
- **Minimap Model**: Derived, never stored. The map's dimensions, its blocked tiles, its exits, the
  player's position, and the live entity positions — all already present in loaded state.
- **Map Progress Summary**: Derived counts of monsters remaining and lessons remaining on the
  current map.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A player returning to a map after a break can state what they still have to do there
  within 5 seconds of looking at the screen, without walking.
- **SC-002**: The player marker matches the player's true position on every tile of every map,
  verified automatically.
- **SC-003**: The minimap renders correctly on all six current maps, and on a map with no entities.
- **SC-004**: The feature adds zero fields to saved player state, verified by a save round-trip
  test.
- **SC-005**: The full automated test suite still completes in under 30 seconds.
- **SC-006**: The minimap never overlaps the question panel, dialogue box, or challenge panel at
  390 px, 820 px, or 1280 px wide.
- **SC-007**: Both Thai and English are complete for all new text, verified automatically.
- **SC-008**: Map names are authored in content — adding a map's name requires no source change.

## Assumptions

- **No fog of war.** The whole map is shown from the moment the player enters it. The maps are
  20×15 and largely on screen already, so hiding them would add frustration without adding
  challenge. Fog of war is recorded as future scope, not rejected forever.
- **All entities on the map are shown**, including monsters the player has not met. This matches
  the existing design, where encounters are visible on the map and chosen rather than random —
  hiding them on the minimap would contradict what the player can already see.
- **The minimap is always visible during exploration** rather than toggled. A toggle adds a control
  and a state for something small enough to leave on.
- The minimap is hidden during battle, dialogue, the chapter challenge, and the story opening,
  where the player is not navigating.
- Map names are added to existing chapter content rather than introducing a new content file.
- Desktop remains the primary target; the minimap is verified at mobile viewport sizes.

## Out of Scope

- Fog of war, or any tracking of which tiles the player has visited.
- A full-screen or zoomable world map spanning multiple maps.
- Waypoints, pings, custom markers, or fast travel.
- Any new persisted player state.
- Any new question type or battle mechanic.
- Minimap art assets — this is drawn from map data, not from a supplied image.
