# Quickstart: Authoring Chapter 2

> The tooling described here does not exist yet — this is the contract implementation must satisfy.
> Everything under "Verify" already works today against Chapter 1.

## Add a word

```bash
npm run author
```

Answer the prompts (word, both meanings, topic, forms, one example, chapter). The tool writes into
`src/content/data/` and tells you what it added.

If it refuses, it will say why in one sentence — for example, *"`read` and its past form are
spelled identically; a multiple-choice question cannot distinguish them."* That is the tool
teaching a rule, not an error to work around.

## Add a monster, an NPC, a map

Still content edits, exactly as in Chapter 1 — see
[001 quickstart](../001-chapter1-vertical-slice/quickstart.md#adding-content--no-code-changes).
Nothing about that changed.

## Add the chapter itself

In `chapters.json`, add a chapter with `requiresChapterId: "chapter-1"` and list its vocabulary,
grammar, monsters, NPCs, boss, challenge, and completion reward.

## Verify

```bash
npm run author -- --check   # validate content without writing
npm test                    # full suite, must stay under 30s
npm run generate:placeholders
npm run dev                 # → /play
```

Play it: `/play?map=<chapter-2-map>` drops you straight into the new maps, and
`/play?battle=<monster-id>` into a single fight.

## What "done" looks like

- `npm test` green, including the cross-chapter review measurement
- No file outside `src/content/data/` changed — this is SC-002, and it is checked by looking at
  the diff
- A save from Chapter 1 loads and reaches Chapter 2 with everything intact
- Both locales complete, and no English under test accidentally translated

## The measurement this feature exists to take

Time yourself. **How long did authoring Chapter 2 take, and how much of that was fighting the
tooling rather than writing content?**

That number is the deliverable. If the answer is "mostly writing content", the pipeline scales and
chapters 3 through 6 are a content exercise. If the answer is "mostly fighting the tooling", that
is worth knowing at chapter 2 rather than at chapter 6 — and the next feature is a better tool,
not more chapters.
