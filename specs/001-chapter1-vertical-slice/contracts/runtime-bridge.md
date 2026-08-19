# Contract: Runtime Bridge

`src/runtime/` is the only thing React and Phaser share. It holds current game state, hands both
renderers the same snapshot, and forwards typed intents into `src/core/`.

**The one rule**: the bridge routes, core decides. If a calculation appears in this layer — damage,
victory, mastery, reward totals — it is misplaced and belongs in `src/core/`. This is checked in
review, and it is what keeps Principle II true now that there are two renderers.

---

## Store

```ts
interface GameStore {
  getSnapshot(): GameState;
  subscribe(listener: () => void): () => void;   // returns unsubscribe
  dispatch(intent: Intent): void;
}

createGameStore(deps: {
  content: ContentIndex;
  balance: BalanceConfig;
  rng: Rng;
  save: SaveRepository;
}): GameStore
```

`getSnapshot()` returns a stable reference that changes identity only when state changes, so
`useSyncExternalStore` does not re-render on every call.

## GameState

```ts
type GameState = {
  screen: "title" | "world" | "dialogue" | "battle" | "challenge" | "journal";
  player: PlayerState;
  battle: BattleState | null;
  dialogue: DialogueState | null;
  challenge: ChallengeState | null;
  world: { mapId: string; entities: MapEntity[] } | null;
  notice: Notice | null;        // storage warning, unreadable save, content error
};
```

All of these types are owned by `src/core/`. The bridge introduces no state shapes of its own — it
composes core's.

## Intents

Renderers never mutate state. They send intents:

```ts
type Intent =
  | { type: "answer-question"; optionIndex: number }
  | { type: "use-pet-ability" }
  | { type: "attempt-flee" }
  | { type: "dismiss-feedback" }
  | { type: "move"; direction: Direction }
  | { type: "interact" }
  | { type: "advance-dialogue" }
  | { type: "answer-practice"; optionIndex: number }
  | { type: "answer-challenge"; optionIndex: number }
  | { type: "open-journal" } | { type: "close-journal" }
  | { type: "equip"; itemId: string }
  | { type: "set-locale"; locale: "th" | "en" }
  | { type: "start-battle"; monsterId: string }
  | { type: "new-game" } | { type: "continue-game" };
```

The union is closed. Adding an intent is a deliberate change, which is what keeps the surface between
renderers and rules from growing by accident.

**Implementation note (T028)**: the union grows with the features that handle it. Principle VI
forbids placeholder architecture, so a variant lands in the same phase as its handler rather than
sitting here unhandled. Phase 2 shipped `new-game`, `continue-game`, `set-locale`, and
`dismiss-notice`; `answer-question` and the battle guard arrive with US1, `move`/`interact` with
US2, and so on. The *guard mechanism* that drops disallowed intents exists and is tested now — only
the battle-specific guard is pending.

The same applies to `GameState`: the `battle`, `dialogue`, `challenge`, and `world` slots are added
by the phases that define their state types, because inventing those shapes before their rules
exist is exactly the speculation Principle VI rejects.

**Intent handling is where input locking lives.** An `answer-question` intent arriving while
`battle.phase !== "awaiting-answer"` is **dropped** by the store, not queued (FR-010). Core also
throws on that case as a second line of defence; the store's job is to make sure core never sees it.

---

## React binding

```ts
function useGameState<T>(selector: (s: GameState) => T): T   // useSyncExternalStore
function useDispatch(): (intent: Intent) => void
```

Components select the narrowest slice they need so a battle HP change does not re-render the journal.

## Phaser binding

Scenes subscribe in `create()` and **must** unsubscribe in `shutdown()`:

```ts
const unsubscribe = store.subscribe(() => this.syncFromState(store.getSnapshot()));
this.events.once("shutdown", unsubscribe);
```

A scene that forgets to unsubscribe leaks a listener across every scene transition and will eventually
update a destroyed scene. This is the most likely defect in this layer, which is why it is written
here rather than left to memory.

---

## Who renders what

Both renderers read the same `GameState`. They must never disagree, so the division is by concern,
never by duplicated state:

| State | React reads | Phaser reads |
|---|---|---|
| `battle.currentQuestion` | ✅ renders prompt and options | ❌ |
| `battle.monsterHp` / `playerHp` | ✅ renders HP bars | ✅ triggers hurt animation |
| `battle.phase` | ✅ disables input | ✅ plays the matching animation |
| `dialogue.lines` | ✅ renders the box | ❌ |
| `world.entities` | ❌ | ✅ positions sprites |
| `player.mastery` | ✅ journal and stars | ❌ |

Both read `monsterHp`; neither stores it. That is the whole point — one number, two views, no
possible desync.

---

## Lifecycle

1. `/play` mounts `GameCanvas` (client-only, `ssr: false`).
2. Content loads and validates; on failure a content error notice renders and the game does not start.
3. `createGameStore` is called once and held in a ref — **never** recreated on re-render.
4. The Phaser instance is created in an effect, guarded against React Strict Mode's double invocation,
   and destroyed on unmount.
5. React UI and Phaser canvas mount over each other, both subscribed to the same store.

## What this layer must not do

- Compute damage, decide victory or defeat, update mastery, or roll a reward.
- Hold state that core already owns.
- Import Phaser (it would break SSR) or import React components.
- Call `Math.random()` — randomness is core's, through the injected `Rng`.
