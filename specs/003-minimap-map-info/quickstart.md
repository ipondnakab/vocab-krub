# Quickstart: Minimap and Map Information

> This describes the contract implementation must satisfy; the feature is planned, not built.

## Run it

```bash
npm run dev          # → http://localhost:3000/play
```

Dev shortcuts that matter here:

```text
/play?map=village    # a Chapter 1 map
/play?map=ruins      # a Chapter 2 map, different shape of content
/play?battle=monster-go   # the minimap must NOT appear here
```

## Verify

```bash
npm test             # the derivation is pure and fully covered
npm run author:check # every map has a name in both locales
npm run lint
```

## What "done" looks like

**Orientation (US1)**

- The minimap shows the map's shape, and walking three tiles moves the marker three steps.
- Exits are marked where they actually are.
- Changing map redraws it with nothing left over from the previous map.

**What remains (US2)**

- Monsters and NPCs are distinguishable from each other and from the player.
- Defeating a monster removes its marker.
- A patrolling monster's marker moves with it.

**Map information (US3)**

- The map name and chapter title appear in the player's language, and change when the language does.

**Staying out of the way (FR-006, SC-006)**

Check at **390 px, 820 px, and 1280 px** wide that the minimap never overlaps the question panel,
the dialogue box, or the challenge panel.

Do this in a browser rather than by reading the CSS. Feature 001 shipped a layout defect where the
feedback panel pushed the HP bar over the monster, and the test suite was green throughout.

## The likely failure modes, based on what this project has already hit

1. **A fixed-size box instead of derived proportions.** Every map is 20×15 today, so a hardcoded
   box looks right and breaks on the first hand-authored map that is not.
2. **Recomputing terrain on every patrol tick.** 300 collision lookups every 900 ms for a picture
   that has not changed.
3. **A stale marker after a map change.** The classic symptom is the previous map's monsters
   briefly showing on the new one.
4. **Text inside the SVG.** Thai combining marks position correctly in the DOM and unreliably
   elsewhere — the same reason the whole UI is React.
