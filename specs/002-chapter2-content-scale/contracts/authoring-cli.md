# Contract: Authoring CLI

```bash
npm run author            # guided: prompts for one word and writes its content
npm run author -- --check # validate everything without writing
```

**The rule that keeps this honest**: the tool writes exactly the JSON a person could write by
hand, into the existing content files. It introduces **no new format**. If the tool ever emits
something a hand-editor cannot read and modify, there are two sources of truth and Principle III
is broken in a way that is expensive to unwind.

---

## What it asks a human for

Only what a human must supply — meaning, judgement, and language:

| Prompt | Example |
|---|---|
| Word | `sing` |
| Meaning (Thai) | `ร้องเพลง` |
| Meaning (English) | `to make music with your voice` |
| Topic | `daily-life` |
| Forms | `sing / sang / sung / singing` |
| One example sentence | `I sing every day.` |
| Chapter | `chapter-2` |

## What it derives

Everything mechanical: mastery components, one question per component, difficulty tiers, question
levels, grammar dependencies, distractors, and both locales of every explanation.

## What it REFUSES to write

Each refusal is a defect Chapter 1 actually shipped or nearly shipped. They are encoded here so
the next author cannot repeat them.

| Refusal | The bug it prevents |
|---|---|
| Two forms spelled identically | `read` / `read` / `read` — a multiple-choice question cannot ask you to choose between identical options. Chapter 1 had to drop the word. |
| Fewer than 2 questions answerable with no grammar learned | A first battle fought before any lesson asked its one askable question, then threw. Chapter 1 hit this; question selection genuinely failed. |
| A third-person distractor made by appending `s` | Produced `I gos every day.` A non-word is a weak distractor; the error a learner actually makes (`I goes`) is the one worth offering. Proper `-s`/`-es`/`-ies` rules apply. |
| A mastery component with no question | That component could never be mastered, so the word could never reach 100%. |
| A distractor equal to the correct answer, or duplicated | Unanswerable question. |

A refusal must explain **why**, in one sentence, not just reject. The tool is also the place an
author learns these rules.

## Relationship to validation

The tool is the first line; `validate.ts` remains the second and is authoritative. Content that
was hand-written, or written by an older version of the tool, must still be caught. Every refusal
above has a corresponding validation rule — FR-003, FR-004, FR-005 — and the two must not drift.

## What it does NOT do

- Write to any file under `src/core/`, `src/components/`, or `src/phaser/`. It touches content
  only, which is what makes SC-002 checkable by inspecting the change set.
- Invent meanings, translations, or example sentences. Those are the author's judgement, and a
  machine-invented Thai gloss is worse than no gloss.
- Generate art. `npm run generate:placeholders` already covers that and runs separately.
