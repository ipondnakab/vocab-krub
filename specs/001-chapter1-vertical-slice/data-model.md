# Phase 1 Data Model: Chapter 1 Vertical Slice

**Feature**: `001-chapter1-vertical-slice` | **Date**: 2026-08-20

Entities are grouped by lifetime: **content** (authored, read-only at runtime), **player state**
(persisted, mutable), and **runtime state** (transient, never persisted).

Notation: `Localized` means `{ th: string, en: string }`. Plain `string` on a target-language field
means it is English under test and is **never** translated (R-009).

---

## 1. Content Entities

Authored in `src/content/data/`, validated by Zod at load, immutable at runtime.

### VocabularyWord

| Field | Type | Rules |
|---|---|---|
| `id` | `string` | Unique, kebab-case. Referenced by monsters and questions. |
| `word` | `string` | The English base form. Never translated. |
| `meaning` | `Localized` | What the word means, in each locale. |
| `cefr` | `"A1" \| "A2" \| "B1" \| "B2" \| "C1" \| "C2"` | Chapter 1 content is A1. |
| `topic` | `string` | Grouping tag, e.g. `daily-life`, `movement`. |
| `difficulty` | `1..5` | Authoring hint for monster assignment. |
| `forms` | `WordForm[]` | At least one. The word family. |
| `examples` | `Example[]` | At least one usage example. |
| `masteryComponents` | `ComponentId[]` | Derived, not authored — see below. |

`masteryComponents` is **computed** by the content loader, not written by an author: `meaning`, one
`form:<formId>` per entry in `forms`, and `context`. This guarantees FR-023's derivation rule cannot
drift from the authored forms.

### WordForm

| Field | Type | Rules |
|---|---|---|
| `id` | `string` | Unique within the word, e.g. `past`, `past-participle`. |
| `text` | `string` | The inflected form, e.g. `went`. Never translated. |
| `role` | `"base" \| "past" \| "past-participle" \| "present-participle" \| "third-person" \| "plural" \| "comparative" \| "superlative"` | Grammatical role. |
| `roleLabel` | `Localized` | How the role is named to the player. |

### Example

| Field | Type | Rules |
|---|---|---|
| `sentence` | `string` | English sentence using the word. Never translated. |
| `translation` | `Localized` | Translation shown as help. |
| `formId` | `string` | Which form the sentence demonstrates. Must exist on the word. |

### GrammarTopic

| Field | Type | Rules |
|---|---|---|
| `id` | `string` | Unique, e.g. `present-simple`. |
| `name` | `Localized` | Display name. |
| `explanation` | `Localized[]` | Ordered lesson pages. At least one. |
| `patterns` | `string[]` | Example patterns, e.g. `I + verb`. Never translated. |
| `cefr` | CEFR level | |

### Question

| Field | Type | Rules |
|---|---|---|
| `id` | `string` | Unique. |
| `wordId` | `string` | Must reference an existing `VocabularyWord`. |
| `component` | `ComponentId` | Which mastery component this exercises. Must be one of that word's derived components. |
| `level` | `1..5` | Meaning, recognition, word form, fill-blank, context. **Level 6 is rejected by schema.** |
| `difficulty` | `"easy" \| "medium" \| "hard" \| "expert"` | Determines damage. Independent of `level` (R-006). |
| `requiresGrammar` | `string \| null` | Grammar topic id gating eligibility (FR-018). |
| `prompt` | `Localized` | The question as asked. Instructional — localized. |
| `options` | `string[]` | Exactly 4. English under test — never translated. |
| `correctIndex` | `0..3` | Index into `options` **as authored**. Presentation shuffles (FR-021). |
| `explanation` | `Localized` | Shown on a wrong answer (FR-004). Required, never empty. |

**Validation (FR-022)**: `options` must contain no duplicates; no option other than `correctIndex`
may be a valid answer for the prompt; `wordId`, `component`, and `requiresGrammar` must resolve.

### Monster

| Field | Type | Rules |
|---|---|---|
| `id` | `string` | Unique. |
| `wordId` | `string` | The word this monster embodies. Must resolve. |
| `name` | `Localized` | Display name. |
| `maxHp` | `number` | Positive integer. |
| `attack` | `number` | Damage dealt on a player miss, before armor. |
| `isBoss` | `boolean` | Bosses disallow flee (FR-012). |
| `questionPoolIds` | `string[]` | Question ids. Non-empty; all must resolve. |
| `rewards` | `RewardTable` | XP, gold, drops. |
| `sprite` | `SpriteRef` | Per the asset contract. |

### RewardTable

| Field | Type | Rules |
|---|---|---|
| `xp` | `number` | ≥ 0. |
| `gold` | `number` | ≥ 0. |
| `drops` | `Drop[]` | May be empty. |

`Drop`: `{ itemId: string, chance: number }` where `chance` is `0..1`, resolved by the seeded PRNG.

### NPC

| Field | Type | Rules |
|---|---|---|
| `id` | `string` | Unique. |
| `name` | `Localized` | |
| `role` | `"teacher" \| "villager" \| "merchant" \| "scholar" \| "guard"` | |
| `mapId` | `string` | Which map they stand on. |
| `dialogueId` | `string` | First-meeting dialogue tree. Must resolve. |
| `repeatDialogueId` | `string` | Dialogue after their lesson is done (FR-037). Must resolve. |
| `grammarTopicId` | `string \| null` | The lesson they teach, if any. |
| `portrait` | `SpriteRef` | Per the asset contract. |

### DialogueNode

| Field | Type | Rules |
|---|---|---|
| `id` | `string` | Unique. |
| `speakerId` | `string` | NPC id, or `player`. |
| `lines` | `Localized[]` | Ordered pages. At least one. |
| `next` | `string \| null` | Next node id, or end. |
| `practiceQuestionIds` | `string[]` | Asked inside the dialogue frame (FR-035). May be empty. |
| `teachesGrammarId` | `string \| null` | Marks the topic learned on completion (FR-036). |

### Item / Equipment / Pet

| Field | Type | Rules |
|---|---|---|
| `id` | `string` | Unique. |
| `name` | `Localized` | |
| `description` | `Localized` | |
| `kind` | `"weapon" \| "armor" \| "consumable" \| "pet"` | |
| `effects` | `Effect[]` | Declared as data (FR-041). |
| `unlock` | `Unlock \| null` | How it is obtained. |

`Effect` is a discriminated union, and the set is **closed** — a new effect kind requires a spec
change, which is how FR-043 stays enforceable:

| Effect kind | Payload | Meaning |
|---|---|---|
| `damage-multiplier` | `value: number` | Scales player attack damage. |
| `damage-reduction` | `value: number` | Flat reduction of incoming damage, floored at 0. |
| `first-mistake-free` | `scope: string` | First miss of the scoped kind per battle deals 0. |
| `reveal-wrong-option` | `usesPerBattle: number` | Removes one incorrect option. |
| `xp-bonus` | `value: number` | Multiplies XP earned. |

No effect kind may select, submit, or skip an answer. This is asserted by a test over the union, not
just stated here.

`Unlock`: `{ type: "words-mastered", threshold: number }` | `{ type: "chapter-complete", chapterId: string }` | `{ type: "monster-drop" }`.

### Chapter

| Field | Type | Rules |
|---|---|---|
| `id` | `string` | e.g. `chapter-1`. |
| `title` | `Localized` | |
| `mapIds` | `string[]` | Village, forest, cave. |
| `vocabularyIds` | `string[]` | ≥ 30 for Chapter 1 (SC-003). |
| `grammarTopicIds` | `string[]` | ≥ 2 for Chapter 1. |
| `monsterIds` | `string[]` | |
| `npcIds` | `string[]` | |
| `bossMonsterId` | `string` | Must be a monster with `isBoss: true`. |
| `challenge` | `ChallengeConfig` | |
| `completionReward` | `RewardTable` | |

`ChallengeConfig`: `{ questionCount: number, passThreshold: number (0..1), guardNpcId: string }`.

### BalanceConfig

Every tunable number in the game. No gameplay module may contain a literal where one of these applies.

```text
damage.byDifficulty       { easy: 10, medium: 20, hard: 30, expert: 50 }
player.baseMaxHp          100
player.hpPerLevel         20
player.xpCurve            [0, 100, 250, 450, 700, 1000, ...]
mastery.streakRequired    2
questions.reviewProportion        0.3
questions.weightMonsterWord       10
questions.weightUnmasteredComponent 3
questions.weightMasteredComponent   1
questions.recencyPenalty            0.2
battle.fleeSuccessChance  0.6
battle.defeatGoldPenalty  0.1     (fraction of carried gold)
challenge.defaultPassThreshold    0.8
```

Values shown are defaults from the concept document; all are editable without a code change.

---

## 2. Player State (persisted)

The complete set of what a save must round-trip losslessly (FR-054).

### PlayerState

| Field | Type | Notes |
|---|---|---|
| `level` | `number` | Starts at 1. |
| `xp` | `number` | Cumulative. |
| `hp` | `number` | Clamped `0..maxHp` (FR-009). |
| `maxHp` | `number` | Derived from level and balance, stored for round-trip fidelity. |
| `gold` | `number` | ≥ 0. |
| `inventory` | `{ itemId: string, quantity: number }[]` | |
| `equipped` | `{ weapon: string \| null, armor: string \| null, pet: string \| null }` | |
| `mastery` | `Record<wordId, WordMastery>` | |
| `grammarLearned` | `string[]` | Topic ids (FR-036). |
| `monstersDefeated` | `string[]` | Prevents same-visit respawn (FR-033). |
| `chapterProgress` | `Record<chapterId, ChapterProgress>` | |
| `location` | `{ mapId: string, x: number, y: number, facing: Direction }` | |
| `locale` | `"th" \| "en"` | |

### WordMastery

| Field | Type | Notes |
|---|---|---|
| `wordId` | `string` | |
| `components` | `Record<ComponentId, ComponentMastery>` | One per derived component. |
| `encountered` | `boolean` | Gates entry into the review pool (FR-020). |

### ComponentMastery

| Field | Type | Notes |
|---|---|---|
| `streak` | `number` | Consecutive correct. |
| `mastered` | `boolean` | `streak >= balance.mastery.streakRequired`. |
| `attempts` | `number` | Total, for the journal. |
| `correct` | `number` | Total, for the journal. |

**State rules (R-005, FR-024/025/027)**:

- correct → `streak++`, `correct++`, `attempts++`; `mastered` recomputed.
- incorrect and not mastered → `streak = 0`, `attempts++`.
- incorrect and mastered → `streak = streakRequired - 1`, `mastered = false`, `attempts++`.
- Mastery is **never** modified by defeat, flee, quit, or reload.

`WordMastery.percent` = mastered components ÷ total components. `MASTERED` at exactly 1.0.

### ChapterProgress

| Field | Type | Notes |
|---|---|---|
| `chapterId` | `string` | |
| `bossDefeated` | `boolean` | Gates the challenge (FR-045). |
| `challengeAttempts` | `number` | Unlimited retries (FR-047). |
| `challengeBestScore` | `number` | `0..1`. |
| `completed` | `boolean` | Only on a pass (FR-048). |

---

## 3. Runtime State (never persisted)

### BattleState

| Field | Type | Notes |
|---|---|---|
| `monsterId` | `string` | |
| `monsterHp` | `number` | Clamped `0..maxHp`. |
| `playerHp` | `number` | Mirrors player state during battle; written back on end. |
| `turn` | `number` | Starts at 1. |
| `phase` | `"awaiting-answer" \| "resolving" \| "showing-feedback" \| "ended"` | Drives input locking (FR-010). |
| `currentQuestion` | `Question \| null` | |
| `askedQuestionIds` | `string[]` | Feeds the recency penalty (FR-013). |
| `petUsesRemaining` | `number` | Per-battle ability budget (FR-042). |
| `revealedWrongIndices` | `number[]` | Options removed by a pet ability. |
| `outcome` | `"victory" \| "defeat" \| "fled" \| null` | |
| `masteryDelta` | `MasteryEvent[]` | Applied immediately, replayed for the summary screen. |

**Turn ordering (resolves the "both reach zero" edge case)**: exactly one combatant acts per turn.
A correct answer means only the player acts; an incorrect answer means only the monster acts. Both
HP totals can therefore never reach zero on the same turn, and victory is checked before the next
question is drawn.

### ChallengeState

| Field | Type | Notes |
|---|---|---|
| `chapterId` | `string` | |
| `questions` | `Question[]` | Freshly drawn per attempt (FR-047). |
| `index` | `number` | |
| `answers` | `{ questionId: string, correct: boolean }[]` | |
| `score` | `number` | `0..1`. |
| `outcome` | `"passed" \| "failed" \| null` | |

No HP field exists on `ChallengeState`. The challenge cannot damage the player because it has no
mechanism to (FR-047, US6 scenario 6) — enforced by the type, not by a conditional.

---

## 4. Relationships

```text
Chapter ──< VocabularyWord ──< WordForm
   │              │
   │              └──< Question >── GrammarTopic
   │                      │
   ├──< Monster ──────────┘ (questionPoolIds)
   │       └── VocabularyWord (wordId)
   │       └── RewardTable ──< Drop >── Item
   │
   ├──< NPC ──< DialogueNode >── Question (practice)
   │      └── GrammarTopic
   │
   └── ChallengeConfig ── NPC (guard)

PlayerState ──< WordMastery ──< ComponentMastery
      │
      ├──< ChapterProgress >── Chapter
      └──> Item / Equipment / Pet (inventory, equipped)
```

**Referential integrity** is validated at load time across every arrow above. A dangling id fails
with the file and field path named (FR-050), so a content author learns about a typo in CI rather
than a player finding a blank battle screen.

---

## 5. Derived Values (never stored)

Computed on read so they cannot go stale:

- `WordMastery.percent` — from component flags.
- `PlayerState.attackDamage(question)` — from the question's difficulty tier and the equipped weapon.
- `PlayerState.incomingDamage(monster)` — from the monster's attack and the equipped armor, floored
  at 0.
- `Chapter.challengeUnlocked` — from `ChapterProgress.bossDefeated`.
- `wordsMasteredCount` — drives equipment unlock thresholds (FR-044).

The one deliberate exception is `PlayerState.maxHp`, which is stored despite being derivable, so that
a future change to the balance curve cannot retroactively alter an existing save's HP.
