import { describe, expect, it, vi } from "vitest";
import { createGameStore, type GameStoreDeps } from "../../src/runtime/GameStore";
import type { PlayerState } from "../../src/core/player/playerState";
import type { SaveLoadResult, SaveRepository } from "../../src/core/save/SaveRepository";
import { balance, content } from "../helpers/fixtures";
import { createRng } from "../../src/core/rng/rng";

function fakeSave(overrides: Partial<SaveRepository> = {}): SaveRepository {
  return {
    isAvailable: () => true,
    load: (): SaveLoadResult => ({ status: "empty" }),
    save: () => {},
    clear: () => {},
    ...overrides,
  };
}

function deps(save: SaveRepository = fakeSave()): GameStoreDeps {
  return { content, balance, rng: createRng(1), save, startMapId: "village", startX: 3, startY: 4 };
}

describe("GameStore — subscription", () => {
  it("notifies subscribers when state changes", () => {
    const store = createGameStore(deps());
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ type: "new-game" });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("keeps snapshot identity stable across no-op reads", () => {
    // useSyncExternalStore re-renders whenever identity changes, so a fresh object per read
    // would put React into an infinite loop.
    const store = createGameStore(deps());
    expect(store.getSnapshot()).toBe(store.getSnapshot());
  });

  it("changes snapshot identity when state changes", () => {
    const store = createGameStore(deps());
    const before = store.getSnapshot();
    store.dispatch({ type: "new-game" });
    expect(store.getSnapshot()).not.toBe(before);
  });

  it("stops delivering after unsubscribe", () => {
    const store = createGameStore(deps());
    const listener = vi.fn();
    const unsubscribe = store.subscribe(listener);
    unsubscribe();
    store.dispatch({ type: "new-game" });
    expect(listener).not.toHaveBeenCalled();
  });

  it("supports both renderers subscribing at once", () => {
    // React and Phaser both subscribe. Both must see the same change.
    const store = createGameStore(deps());
    const react = vi.fn();
    const phaser = vi.fn();
    store.subscribe(react);
    store.subscribe(phaser);
    store.dispatch({ type: "new-game" });
    expect(react).toHaveBeenCalledTimes(1);
    expect(phaser).toHaveBeenCalledTimes(1);
  });
});

describe("GameStore — intent guards (FR-010)", () => {
  it("DROPS a guarded intent rather than queueing it", () => {
    // No notice is showing, so dismiss-notice is not merely ignored later — it never applies.
    const store = createGameStore(deps());
    const listener = vi.fn();
    store.subscribe(listener);
    const before = store.getSnapshot();

    store.dispatch({ type: "dismiss-notice" });

    expect(store.getSnapshot()).toBe(before);
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not replay a dropped intent once the guard would allow it", () => {
    // The proof that intents are dropped and not queued: a later valid state must not suddenly
    // apply the earlier intent.
    const store = createGameStore(deps(fakeSave({ load: () => ({ status: "unreadable", reason: "malformed" }) })));
    store.dispatch({ type: "dismiss-notice" }); // dropped: no notice yet
    store.dispatch({ type: "continue-game" }); // creates a notice
    expect(store.getSnapshot().notice?.kind).toBe("save-unreadable");
  });

  it("drops continue-game once the player has left the title screen", () => {
    const store = createGameStore(deps());
    store.dispatch({ type: "new-game" });
    const after = store.getSnapshot();
    store.dispatch({ type: "continue-game" });
    expect(store.getSnapshot()).toBe(after);
  });
});

describe("GameStore — save integration", () => {
  it("warns immediately when storage is unavailable (FR-056)", () => {
    const store = createGameStore(deps(fakeSave({ isAvailable: () => false })));
    expect(store.getSnapshot().notice).toEqual({ kind: "storage-unavailable" });
  });

  it("starts a new game and persists it", () => {
    const save = vi.fn();
    const store = createGameStore(deps(fakeSave({ save })));
    store.dispatch({ type: "new-game" });
    expect(store.getSnapshot().screen).toBe("world");
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("loads an existing save on continue", () => {
    const saved = { level: 7, gold: 250 } as unknown as PlayerState;
    const store = createGameStore(deps(fakeSave({ load: () => ({ status: "ok", player: saved }) })));
    store.dispatch({ type: "continue-game" });
    expect(store.getSnapshot().player).toBe(saved);
  });

  it("starts a new game when no save exists, without an error (FR-055)", () => {
    const store = createGameStore(deps(fakeSave({ load: () => ({ status: "empty" }) })));
    store.dispatch({ type: "continue-game" });
    expect(store.getSnapshot().screen).toBe("world");
    expect(store.getSnapshot().notice).toBeNull();
  });

  it("surfaces an unreadable save as a notice rather than crashing (FR-055)", () => {
    const store = createGameStore(deps(fakeSave({ load: () => ({ status: "unreadable", reason: "schemaVersion" }) })));
    expect(() => store.dispatch({ type: "continue-game" })).not.toThrow();
    expect(store.getSnapshot().notice).toEqual({ kind: "save-unreadable", detail: "schemaVersion" });
    expect(store.getSnapshot().screen).toBe("title");
  });
});

describe("GameStore — locale", () => {
  it("switches locale on the player state", () => {
    const store = createGameStore(deps());
    expect(store.getSnapshot().player.locale).toBe("th");
    store.dispatch({ type: "set-locale", locale: "en" });
    expect(store.getSnapshot().player.locale).toBe("en");
  });
});

describe("GameStore — battle intents (FR-010)", () => {
  const inBattle = (monsterId = "monster-eat") => {
    const store = createGameStore(deps());
    store.dispatch({ type: "new-game" });
    store.dispatch({ type: "start-battle", monsterId });
    return store;
  };

  it("starts a battle and mirrors the player into game state", () => {
    const store = inBattle();
    const s = store.getSnapshot();
    expect(s.screen).toBe("battle");
    expect(s.battle?.monsterId).toBe("monster-eat");
    expect(s.player).toBe(s.battle?.player);
  });

  it("drops a second start-battle while one is already running", () => {
    const store = inBattle();
    const before = store.getSnapshot();
    store.dispatch({ type: "start-battle", monsterId: "monster-go" });
    expect(store.getSnapshot()).toBe(before);
  });

  it("DROPS an answer that arrives while feedback is showing", () => {
    // The queued-answer bug: an answer submitted during a death animation must never resolve
    // into a battle that has already moved on.
    const store = inBattle();
    const q = store.getSnapshot().battle!.currentQuestion!;
    store.dispatch({ type: "answer-question", optionIndex: (q.correctIndex + 1) % 4 });
    expect(store.getSnapshot().battle?.phase).toBe("showing-feedback");

    const during = store.getSnapshot();
    const listener = vi.fn();
    store.subscribe(listener);
    store.dispatch({ type: "answer-question", optionIndex: 0 });

    expect(store.getSnapshot()).toBe(during);
    expect(listener).not.toHaveBeenCalled();
  });

  it("does not replay a dropped answer once the phase allows one again", () => {
    const store = inBattle();
    const q = store.getSnapshot().battle!.currentQuestion!;
    store.dispatch({ type: "answer-question", optionIndex: (q.correctIndex + 1) % 4 });
    store.dispatch({ type: "answer-question", optionIndex: 0 }); // dropped
    const turnBefore = store.getSnapshot().battle!.turn;
    store.dispatch({ type: "dismiss-feedback" });
    // Exactly one turn advanced — the dropped intent did not resurface.
    expect(store.getSnapshot().battle!.turn).toBe(turnBefore + 1);
    expect(store.getSnapshot().battle!.phase).toBe("awaiting-answer");
  });

  it("drops flee on a boss, so core's throw is never reached", () => {
    const store = inBattle("monster-go");
    const before = store.getSnapshot();
    expect(() => store.dispatch({ type: "attempt-flee" })).not.toThrow();
    expect(store.getSnapshot()).toBe(before);
  });

  it("drops leave-battle until the battle has actually ended", () => {
    const store = inBattle();
    const before = store.getSnapshot();
    store.dispatch({ type: "leave-battle" });
    expect(store.getSnapshot()).toBe(before);
  });

  it("returns to the world and saves once the battle ends", () => {
    const save = vi.fn();
    const store = createGameStore(deps(fakeSave({ save })));
    store.dispatch({ type: "new-game" });
    store.dispatch({ type: "start-battle", monsterId: "monster-eat" });

    for (let i = 0; i < 60 && store.getSnapshot().battle?.phase !== "ended"; i += 1) {
      const battle = store.getSnapshot().battle!;
      if (battle.phase === "awaiting-answer") {
        store.dispatch({ type: "answer-question", optionIndex: battle.currentQuestion!.correctIndex });
      } else {
        store.dispatch({ type: "dismiss-feedback" });
      }
    }
    expect(store.getSnapshot().battle?.outcome).toBe("victory");

    store.dispatch({ type: "leave-battle" });
    expect(store.getSnapshot().screen).toBe("world");
    expect(store.getSnapshot().battle).toBeNull();
    expect(save).toHaveBeenCalledTimes(2); // new-game, then battle end
  });
});
