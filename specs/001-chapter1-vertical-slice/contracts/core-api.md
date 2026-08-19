# Contract: Core API

**The surface `src/runtime/` is allowed to call.** Everything here lives in `src/core/` and imports
no Phaser, no React, no Next, no DOM, no `window`. Anything not listed here is internal to core, and
importing it from outside is a violation caught by the layering lint rules (R-011).

The shape of the boundary: **renderers send intents to the bridge, the bridge calls core, core owns
every rule.** No React component and no Phaser scene computes damage, decides victory, updates
mastery, or picks a question — and neither does the bridge.

Renderers reach these functions through `src/runtime/`, not directly. See
[runtime-bridge.md](./runtime-bridge.md).

---

## Battle

```ts
createBattle(input: {
  monsterId: string;
  player: PlayerState;
  content: ContentIndex;
  balance: BalanceConfig;
  rng: Rng;
}): BattleState

submitAnswer(state: BattleState, optionIndex: number): BattleTurnResult

usePetAbility(state: BattleState): BattleState        // reveal-wrong-option
attemptFlee(state: BattleState): FleeResult
endBattle(state: BattleState, player: PlayerState): BattleOutcome
```

`BattleTurnResult`:

```ts
{
  state: BattleState;              // next state, never mutated in place
  correct: boolean;
  damageDealt: number;             // 0 when incorrect
  damageTaken: number;             // 0 when correct
  feedback: {                      // present when correct === false (FR-004)
    correctOption: string;
    explanation: Localized;
  } | null;
  masteryEvents: MasteryEvent[];   // already applied to player mastery
  outcome: "victory" | "defeat" | null;
}
```

**Rules enforced inside, not by callers:**

- Exactly one side acts per turn (FR-002, FR-003).
- HP clamps to `0..max` (FR-009).
- `submitAnswer` on a state whose `phase !== "awaiting-answer"` throws — this is how FR-010's input
  lock is guaranteed even if a scene mishandles it. A scene that respects `phase` never sees the throw.
- `attemptFlee` throws on a boss battle rather than returning a failure (FR-012), because offering the
  option at all is the bug.
- Victory and defeat are decided here and reported in `outcome`; a scene never compares HP to zero.

---

## Questions

```ts
selectQuestion(input: {
  battle: BattleState;
  player: PlayerState;
  content: ContentIndex;
  balance: BalanceConfig;
  rng: Rng;
}): Question

presentQuestion(question: Question, rng: Rng): PresentedQuestion
gradeAnswer(question: PresentedQuestion, chosenIndex: number): boolean
damageFor(question: Question, weapon: Item | null, balance: BalanceConfig): number
```

`PresentedQuestion` carries the shuffled options and the shuffled correct index (FR-021). Scenes
render `PresentedQuestion` and never see the authored ordering, so option position cannot leak.

`selectQuestion` throws a named error rather than returning `undefined` when no question is eligible —
a content bug surfaces as a message, not a blank screen (R-004).

---

## Mastery

```ts
recordAnswer(mastery: WordMastery, componentId: string, correct: boolean, balance: BalanceConfig): WordMastery
masteryPercent(mastery: WordMastery): number       // 0..1
isWordMastered(mastery: WordMastery): boolean
wordsMasteredCount(player: PlayerState): number
initMastery(word: VocabularyWord): WordMastery
```

Pure functions over plain data. `recordAnswer` implements promotion and demotion (R-005) and is the
only place either happens.

---

## Progression

```ts
applyRewards(player: PlayerState, rewards: RewardTable, rng: Rng, balance: BalanceConfig): {
  player: PlayerState;
  leveledUp: boolean;
  itemsGained: string[];
  equipmentUnlocked: string[];     // from mastery thresholds (FR-044)
}

equip(player: PlayerState, itemId: string, content: ContentIndex): PlayerState
applyDefeatPenalty(player: PlayerState, balance: BalanceConfig): PlayerState
```

`applyDefeatPenalty` touches gold and location only. It cannot reach mastery, XP, level, or inventory,
because it does not accept them as writable — FR-014 is structural, not a promise.

---

## Chapter

```ts
startChallenge(input: { chapterId, player, content, balance, rng }): ChallengeState
answerChallenge(state: ChallengeState, optionIndex: number): ChallengeState
finishChallenge(state: ChallengeState, player: PlayerState, content: ContentIndex): {
  player: PlayerState;
  passed: boolean;
  weakestTopics: string[];         // what the guard names on failure (US6 scenario 4)
}
isChallengeUnlocked(player: PlayerState, chapterId: string): boolean
```

`ChallengeState` has no HP field, so no challenge code path can damage the player.

---

## Content, i18n, Config

```ts
loadContent(raw: RawContentFiles, level?: "structural" | "shipping"): ContentIndex
// validates; throws ContentValidationError listing EVERY problem found
ContentIndex.word(id) / .question(id) / .monster(id) / .npc(id) / .item(id) / .chapter(id) / .grammar(id)
ContentIndex.questionsForWord(wordId) / .questionsForComponent(wordId, componentId)

t(key: string, params?: Record<string, string | number>): string
setLocale(locale: "th" | "en"): void
```

`ContentValidationError` carries `issues: ContentIssue[]`, each `{ file, path, message }`, and
renders as `file.json → path: message` (FR-050). See content-schemas.md for why it aggregates.

`t` returns `⟪missing:key⟫` in development for an absent key and is covered by the CI parity check
(FR-051, SC-009).

---

## Save

```ts
interface SaveRepository {
  isAvailable(): boolean;                    // false → warn the player (FR-056)
  load(): SaveLoadResult;
  save(player: PlayerState): void;
  clear(): void;
}

type SaveLoadResult =
  | { status: "ok"; player: PlayerState }
  | { status: "empty" }                      // new game (FR-055)
  | { status: "unreadable"; reason: string } // offer a new game, never crash
```

The interface is owned by `src/core/save/`. `src/platform/LocalStorageSaveRepository.ts` implements it.
A Firebase implementation later adds a file in `src/platform/` and changes nothing else.

---

## Randomness

```ts
interface Rng { next(): number; int(maxExclusive: number): number; pick<T>(items: T[]): T; }
createRng(seed: number): Rng
```

Every core function that randomizes takes `Rng` as a parameter. No core module calls `Math.random()`
(R-007) — enforced by lint alongside the Phaser restriction.

---

## Direction of dependency

`src/runtime/` may call anything above. Core exports no callbacks, holds no reference to a store, a
scene, or a component, and emits no events anything must subscribe to. State flows out as return
values; intent flows in as arguments.

```text
components ──▶ runtime ──▶ core
phaser     ──▶ runtime ──▶ core
core       ──▶ nothing
```

This keeps the dependency arrow one-directional as Principle II requires, and it is why the stack
change from Vite to Next.js left every file in this contract untouched.
