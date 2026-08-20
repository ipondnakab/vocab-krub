# Analysis Findings: Minimap and Map Information

**Feature**: `003-minimap-map-info` | **Analysed**: 2026-08-20 | **Status**: recorded, **not fixed**

Output of a read-only `/speckit-analyze` pass. **Nothing here has been applied.** It is written down
because the findings existed only in a conversation, and a conversation does not survive changing
machines.

No CRITICAL issues. Implementation may proceed — but U1 is a specification defect, and fixing it
after `T021` is written costs more than fixing it before.

---

## U1 — HIGH — `lessonDone: boolean` is the wrong shape

**Where**: `contracts/minimap-model.md` (`MinimapMarkers.npcs`), `spec.md` FR-011, FR-012

**The problem**: the boolean collapses **three** NPC states into two.

Verified against shipped code, not assumed:

```ts
// src/core/dialogue/dialogue.ts
export function hasCompletedLesson(npcId, player, content): boolean {
  const npc = content.npc(npcId);
  return npc.grammarTopicId !== null && isGrammarLearned(player, npc.grammarTopicId);
}
```

It returns `false` for an NPC with no lesson — and **8 of the 12 shipped NPCs have none**: every
merchant, every villager, and both guards. Only the four teachers and scholars teach anything.

As specified, two-thirds of NPCs would be marked as outstanding homework they are incapable of
giving.

**Recommended fix**

```ts
npcs: Array<{ x: number; y: number; npcId: string; lesson: "none" | "outstanding" | "done" }>
```

- Amend **FR-011** to name the third state.
- Exclude `"none"` from `lessonsRemaining` (**FR-012**), or the count is permanently wrong by 8.
- `T019` and `T021` both change.

---

## F1 — MEDIUM — FR-006 guards a collision that cannot happen

**Where**: `spec.md` FR-006, SC-006; `tasks.md` T031

FR-006 forbids obstructing the question panel, dialogue box, and challenge panel. But R-304 renders
the minimap only while `screen === "world"`, and all three of those set a different screen — so
that overlap is **structurally impossible**.

Meanwhile the overlap that genuinely can happen is not mentioned anywhere:

```css
.worldhud { position: absolute; top: 1rem; left: 1rem; max-width: 18rem; }
```

`WorldHud` renders on the same screen as the minimap, anchored top-left.

**Recommended fix**: rewrite FR-006 to guard against overlapping the exploration HUD. Keep the
battle-UI check in T031 as cheap insurance, but stop describing it as the point.

---

## U2 — MEDIUM — the minimap renders under the story opening

**Where**: `research.md` R-304

`StoryOpening` also renders while `screen === "world"`, so the minimap will be drawn beneath it
during the Chapter 1 opening. Its overlay is `inset: 0` at `z-index: 6`, so it happens to cover it
— but that is incidental, not designed, and any z-index change exposes it.

**Recommended fix**: state the rule as "world screen **and** the opening is finished", or give the
minimap an explicit z-index below the story overlay.

---

## F2 — LOW — memoization stated in three places

`plan.md` says terrain is memoized on map identity; `contracts/minimap-model.md` puts derivation in
core; `T027` memoizes in the component. All compatible (a `useMemo` keyed on map id), but say it
once, in the contract.

---

## E1 — LOW — three success criteria cannot be proven by CI

`T031`, `T033`, and `T034` are browser or human verification, so **SC-001, SC-002, and SC-006**
have no automatable assertion. Legitimate for what they measure; recorded so the gap is known
rather than assumed covered.

---

## Coverage and metrics

```
Total requirements     26  (18 FR + 8 SC)
Total tasks            36
FR coverage            18/18 (100%)
SC coverage             8/8  (100%)
Critical issues         0
Constitution gates      8/8 pass
```

This is the first feature in the project with **no CRITICAL finding and an empty Complexity
Tracking table**. Features 001 and 002 both carried a Principle VI conflict — breadth built before
the loop was validated. This one adds no state, no mechanic, and no dependency, so that principle
has nothing to object to.

---

## Method note

U1 and F1 were found by checking the documents against the shipped code rather than trusting
documents written an hour earlier. That is the same way the `challengePool` defect surfaced in
feature 002, and it is now the third time it has paid for itself.
