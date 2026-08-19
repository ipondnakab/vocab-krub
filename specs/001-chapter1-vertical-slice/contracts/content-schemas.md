# Contract: Content Schemas

Zod schemas in `src/content/schemas/` are the single source of truth for content shape. TypeScript
types are derived with `z.infer`, so a schema and its type cannot drift (R-003).

Field-level detail lives in [data-model.md](../data-model.md). This document covers the **validation
rules that span files** and the error contract.

---

## Files and schemas

| File | Schema | Root shape |
|---|---|---|
| `balance.json` | `BalanceConfigSchema` | object |
| `vocabulary.json` | `VocabularySchema` | `{ words: VocabularyWord[] }` |
| `questions.json` | `QuestionsSchema` | `{ questions: Question[] }` |
| `grammar.json` | `GrammarSchema` | `{ topics: GrammarTopic[] }` |
| `monsters.json` | `MonstersSchema` | `{ monsters: Monster[] }` |
| `npcs.json` | `NpcsSchema` | `{ npcs: NPC[] }` |
| `dialogue.json` | `DialogueSchema` | `{ nodes: DialogueNode[] }` |
| `items.json` | `ItemsSchema` | `{ items: Item[] }` |
| `pets.json` | `PetsSchema` | `{ pets: Item[] }` (kind `pet`) |
| `chapters.json` | `ChaptersSchema` | `{ chapters: Chapter[] }` |

---

## Cross-file validation

Zod validates one file's shape. These rules span files and run in a second pass after all files parse.
All of them fail the build (FR-050).

**Referential integrity**

- Every `wordId`, `questionId`, `monsterId`, `npcId`, `itemId`, `grammarTopicId`, `dialogueId`, and
  `mapId` reference resolves to a defined entity.
- Every `Question.component` is one of its word's derived components.
- Every `Example.formId` exists on its word.
- Every `Chapter.bossMonsterId` refers to a monster with `isBoss: true`.
- Every `ChallengeConfig.guardNpcId` refers to an NPC with `role: "guard"`.
- Every map spawn's `npcId` / `monsterId` resolves, and every transition has a counterpart in the
  destination map.

**Uniqueness**

- Ids are unique within their entity type.
- `Question.options` contains no duplicates.
- `WordForm.id` is unique within its word.

**Answer soundness (FR-022)**

- `correctIndex` is within `options` bounds.
- No option other than the correct one matches any valid form or accepted answer for that prompt —
  this catches the authoring mistake where `gone` is offered as a distractor to "what is the past
  tense of go?" alongside `went` when the prompt would accept either.
- `explanation` is non-empty in both locales.

**Localization (FR-051, FR-052)**

- Every `Localized` field has both `th` and `en`, both non-empty.
- Target-language fields — `word`, `WordForm.text`, `Question.options`, `Example.sentence`,
  `GrammarTopic.patterns` — are plain strings. A `Localized` object in one of these positions is a
  schema error, which is how "never translate the English under test" is made unrepresentable rather
  than merely discouraged.

**Chapter completeness (SC-003)** — enforced at the `"shipping"` validation level only

Validation runs at one of two levels. `"structural"` (always on, including at game load) covers
referential integrity, uniqueness, and answer soundness — a violation there is a broken game.
`"shipping"` adds the completeness rules below — a violation there is an unfinished chapter, not
a broken engine. Seed content in Phase 2 is deliberately incomplete; T118 turns `"shipping"` on
once the full chapter is authored.

- Chapter 1 declares ≥ 30 vocabulary words, ≥ 2 grammar topics, ≥ 6 NPCs, ≥ 6 monsters plus a boss,
  ≥ 3 items, ≥ 1 pet.
- Every declared vocabulary word has ≥ 1 question per derived mastery component — otherwise a
  component could never be mastered and a word could never reach 100%.
- Every question level 1–5 appears at least once across the chapter (SC-004).
- No question has `level: 6` — the schema rejects it outright (FR-016).

---

## Error contract

```ts
interface ContentIssue {
  file: string;      // "questions.json"
  path: string;      // "questions[42].options[2]"
  message: string;   // "duplicate option: 'went'"
}

class ContentValidationError extends Error {
  issues: readonly ContentIssue[];
}
```

**Revised 2026-08-20 (T016)**: this originally described `ContentValidationError` as carrying a
single `{ file, path, message }`, which contradicted the "collect ALL errors" rule below — one
object cannot hold many. The triple moved to `ContentIssue` and the error carries the list.

Rendered as:

```text
questions.json → questions[42].options[2]: duplicate option: 'went'
```

Validation collects **all** errors and reports them together. Failing on the first one would make
fixing a batch of new content a slow one-at-a-time loop.

One exception, added in implementation: if a file fails its *schema* parse, the cross-file pass is
skipped for that run and only the schema errors are reported. Cross-file checks against
half-parsed data produce a cascade of misleading "unknown reference" noise that buries the real
error.

At build time this runs as `tests/content/`. At game load the same validation runs; on failure the
game shows an error screen rather than starting a half-loaded world.

---

## Adding content

Adding a word, monster, NPC, question, item, or pet means editing JSON only. If any addition requires
touching a file under `src/core/`, `src/phaser/`, or `src/components/`, that is a Principle III
violation and a bug in the engine, not a limitation to work around. SC-008 verifies this with an explicit task.
