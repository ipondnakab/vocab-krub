# Contract: Save Format

**Storage key**: `vocab-krub:save:v1` in `localStorage`, one JSON document (R-010).

## Envelope

```json
{
  "schemaVersion": 1,
  "savedAt": "2026-08-20T10:15:00.000Z",
  "gameVersion": "0.1.0",
  "player": { }
}
```

`schemaVersion` is an integer written from the very first save. `gameVersion` is informational only —
never branched on, so a patch release can never accidentally orphan a save.

## Player payload

Exactly the `PlayerState` shape in [data-model.md](../data-model.md#playerstate). Every field is
required; there are no optional fields with silent defaults, because a defaulted field is how a
round-trip loses data without failing (FR-054).

## Load behaviour

| Condition | Result | Player sees |
|---|---|---|
| Key absent | `{ status: "empty" }` | New game at the Chapter 1 opening (FR-055) |
| JSON parse fails | `{ status: "unreadable", reason: "malformed" }` | "Save could not be read" + new game offer |
| Zod validation fails | `{ status: "unreadable", reason: "<field path>" }` | Same, with the field logged for debugging |
| `schemaVersion` > current | `{ status: "unreadable", reason: "newer-version" }` | "Save is from a newer version" |
| `schemaVersion` < current | Run migrations in order; fail closed if any is missing | Loads, or the unreadable path |
| `localStorage` throws | `isAvailable() === false` | "Progress will not be saved this session" (FR-056) |

The game never crashes on a bad save and never silently loads a partial one.

## Migration policy

Per Principle VII, a save format change requires either a migration function or a documented,
deliberate decision to invalidate old saves. Migrations are pure `(oldDoc) => newDoc` functions
registered by source version, applied in sequence, each with a round-trip test.

For this feature there is exactly one version and no migrations. The mechanism exists so that the
first change is routine rather than a rewrite.

## Save timing

Written after: battle end (any outcome), grammar lesson completion, map transition, challenge
attempt, and any inventory or equipment change. Not written mid-battle — a battle interrupted by
quitting is not resumed (US7 scenario 2), but mastery earned during it is already persisted, because
mastery is applied per answer rather than at battle end.

## Round-trip test requirement

SC-010 and FR-054 are verified by a test that builds a `PlayerState` with every field populated
non-trivially — multiple words at different mastery stages, a partial component streak, several
inventory entries, all three equipment slots filled, both chapters progressed — serializes it,
deserializes it, and asserts deep equality.
