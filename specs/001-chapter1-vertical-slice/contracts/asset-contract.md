# Contract: Assets

The project owner supplies all art, tilemaps, and audio. This document is the specification those
files must satisfy. Engineering builds against **generated placeholders** that conform to it exactly,
so real art drops in with no code change (Constitution: Assets).

**The rule that makes this work**: nothing outside this document may be assumed about an asset. If a
scene needs a dimension, a frame index, or a layer name, it must be listed here first.

**Scope note (stack revision 2026-08-20)**: React now renders all UI chrome, so dialogue frames,
buttons, panels, and bars are **CSS, not art**. This contract covers world and character art only —
roughly a third less to draw than the original version asked for.

---

## 1. Global conventions

| Property | Value |
|---|---|
| Tile size | 32 × 32 px |
| Art style | Pixel art, nearest-neighbour scaling, no anti-aliasing |
| Palette | Owner's choice; no constraint imposed |
| Format | PNG with alpha (art), `.tmj` JSON (maps), OGG + M4A pairs (audio) |
| Naming | kebab-case, no spaces, no uppercase |
| Location | `public/assets/<category>/<name>.<ext>` |

Placeholders live in `public/assets/placeholder/` mirroring the same paths, are visibly labelled,
and are overridden by any real file at the corresponding `public/assets/` path.

---

## 2. Character sprite sheets

**Path**: `public/assets/characters/<id>.png`

| Property | Value |
|---|---|
| Frame size | 32 × 48 px |
| Sheet layout | 4 columns × 4 rows, 128 × 192 px total |
| Row order | 0 = down, 1 = left, 2 = right, 3 = up |
| Column order | 0 = idle, 1 = step A, 2 = idle, 3 = step B |
| Origin | Bottom-centre; feet on the tile the character occupies |
| Walk animation | Columns 0→1→2→3, 8 fps, looping |

Required: `player.png`, plus one per NPC id in `npcs.json`.

**Why the 4-column order**: idle appears at both column 0 and 2 so a walk cycle reads as
step-return-step-return without a separate return frame. This is the RPG Maker convention.

---

## 3. Monster sprites

**Path**: `public/assets/monsters/<id>.png`

| Property | Value |
|---|---|
| Battle frame size | 96 × 96 px |
| Sheet layout | 4 columns × 1 row, 384 × 96 px |
| Frame order | 0 = idle, 1 = hurt, 2 = attack, 3 = restored |
| Overworld sprite | Separate file `public/assets/monsters/<id>-overworld.png`, 32 × 32, single frame |

Frame 3 is **restored, not dead**. Per Principle I, a defeated word is freed from The Silence — the
frame should read as the word returning to itself, not as a corpse. Bright, calm, whole.

---

## 4. Portraits

**Path**: `public/assets/portraits/<npc-id>.png` — 96 × 96 px, single frame, shown in the dialogue box.

---

## 5. Tilesets

**Path**: `public/assets/tilesets/<name>.png`

| Property | Value |
|---|---|
| Tile size | 32 × 32 |
| Margin / spacing | 0 / 0 |
| Required sets | `village.png`, `forest.png`, `cave.png` |

Every tile that blocks movement must carry a `collides: true` custom property **in the Tiled tileset
definition**, not in the map. Collision belongs to the tile, so it stays correct wherever the tile is
placed (R-008).

---

## 6. Maps

**Path**: `public/assets/maps/<id>.tmj` — Tiled JSON export, orthogonal, 32 × 32 tiles.

Required maps: `village`, `forest`, `cave`.

**Layer names are contractual.** The loader looks these up by name and fails loudly if one is absent:

| Layer | Type | Purpose |
|---|---|---|
| `ground` | tile | Base terrain. Never collides. |
| `decoration` | tile | Drawn above ground, below entities. |
| `collision` | tile | Any tile present blocks movement. |
| `above` | tile | Drawn above entities — tree canopy, roof edges. |
| `spawns` | object | Entity placement. |
| `transitions` | object | Map links. |

### `spawns` object properties

| Object type | Required properties |
|---|---|
| `player-start` | `facing` (`up`\|`down`\|`left`\|`right`) |
| `npc` | `npcId` (must exist in `npcs.json`), `facing` |
| `monster` | `monsterId` (must exist in `monsters.json`), `patrolRadius` (tiles, 0 = stationary) |

### `transitions` object properties

| Property | Meaning |
|---|---|
| `targetMapId` | Destination map |
| `targetX`, `targetY` | Arrival tile coordinates |
| `facing` | Direction faced on arrival |

Every transition must have a counterpart in the destination map. Validation walks both directions and
fails on a one-way link, so a player can never be stranded (Edge Cases: map transition failure).

---

## 7. UI — not art any more

**No files required.** React renders all UI chrome, and it is styled with CSS: dialogue frames, option
buttons, panels, HP bars, and menus. Pixel-styled borders are `border-image` or box-shadow steps, not
9-slice PNGs.

The one exception is **mastery stars**, which stay as art because they carry the game's visual
identity at the moment a word is restored:

| File | Size | Notes |
|---|---|---|
| `star-filled.png` | 16 × 16 | Mastery display |
| `star-empty.png` | 16 × 16 | Mastery display |

Inline SVG is an acceptable substitute for both if the owner prefers.

**What this removes from the original contract**: `dialogue-box.png`, `menu-panel.png`,
`hp-bar-frame.png`, `hp-bar-fill.png`, and `option-button.png` with its three states. They are CSS now.

---

## 8. Fonts

Loaded through `next/font` in the root layout, self-hosted, not from `public/assets/` (R-016).

Two faces:

| Role | Requirement |
|---|---|
| Display | Headings, RPG chrome, numbers. Pixel face acceptable. Latin sufficient. |
| Text | All body, question, dialogue, and explanation text. **Complete Thai coverage required.** |

Thai coverage means U+0E00–U+0E7F **including combining vowels and tone marks**, which must position
above and below the base glyph rather than as spacing characters. Many pixel fonts claim Thai support
and stack incorrectly — verify with a word that stacks a tone mark over an upper vowel, not with a
plain Thai string.

If no pixel font renders Thai correctly, use a clean Thai-capable text face for content and keep the
pixel face for Latin headings and numbers. Broken glyphs are never an acceptable trade for style.

---

## 9. Audio (optional for this slice)

**Path**: `public/assets/audio/<category>/<name>.ogg` plus a matching `.m4a` for Safari.

The slice is evaluable in silence (spec Assumptions). Hooks exist; no audio file is required to ship.
Suggested set if the owner wants it: `bgm/village`, `bgm/forest`, `bgm/cave`, `bgm/battle`,
`sfx/attack-hit`, `sfx/wrong-answer`, `sfx/level-up`, `sfx/word-restored`.

---

## 10. Placeholder generation

A script, `scripts/generate-placeholders.ts`, writes conforming placeholders for every asset listed
above — characters, monsters, portraits, tilesets, and stars: correct dimensions, correct frame
counts, correct frame order, labelled with the asset id and frame name, in flat unmistakable colours. It also generates the three `.tmj` maps with all six layers
and valid spawn and transition objects.

This is what unblocks every map, movement, collision, dialogue, and battle task before any real art
exists. It is also the validator: **if a placeholder generated from this document does not work in
the game, the contract and the code disagree, and that is a bug to fix now** rather than after the
owner's art arrives.

---

## 11. Owner checklist

To replace placeholders, drop conforming files at the real `public/assets/` paths. No code change, no
rebuild configuration, no registry to update. Priority order, highest impact first:

1. `characters/player.png` and the three tilesets — the game stops looking like a prototype.
2. The three `.tmj` maps — real level design is the single biggest step up in feel.
3. Monster sprites — especially the `restored` frame, which carries the story's whole premise.
4. Portraits — NPCs become characters.
5. Stars and audio.

**Not on this list any more**: dialogue frames, buttons, panels, and bars. React and CSS handle those,
so they never block on you.
