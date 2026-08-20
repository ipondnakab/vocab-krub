import { describe, expect, it, vi } from "vitest";
import { createGameStore, type GameStoreDeps } from "../../src/runtime/GameStore";
import { balance, content, deps as battleDeps } from "../helpers/fixtures";
import type { SaveLoadResult, SaveRepository } from "../../src/core/save/SaveRepository";
import type { PlayerState } from "../../src/core/player/playerState";

function fakeSave(over: Partial<SaveRepository> = {}): SaveRepository {
  return {
    isAvailable: () => true,
    load: (): SaveLoadResult => ({ status: "empty" }),
    save: () => {},
    clear: () => {},
    ...over,
  };
}

const storeDeps = (save: SaveRepository): GameStoreDeps => ({
  content, balance, rng: battleDeps(1).rng, save,
  startMapId: "village", startX: 3, startY: 7,
});

describe("save triggers (T113)", () => {
  it("saves on new game", () => {
    const save = vi.fn();
    createGameStore(storeDeps(fakeSave({ save }))).dispatch({ type: "new-game" });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("saves when a battle ends", () => {
    const save = vi.fn();
    const store = createGameStore(storeDeps(fakeSave({ save })));
    store.dispatch({ type: "new-game" });
    store.dispatch({ type: "start-battle", monsterId: "monster-eat" });
    save.mockClear();

    for (let i = 0; i < 60 && store.getSnapshot().battle?.phase !== "ended"; i += 1) {
      const battle = store.getSnapshot().battle!;
      if (battle.phase === "awaiting-answer") {
        store.dispatch({ type: "answer-question", optionIndex: battle.currentQuestion!.correctIndex });
      } else {
        store.dispatch({ type: "dismiss-feedback" });
      }
    }
    // Not saved DURING the battle — an interrupted fight is not resumed (US7 scenario 2).
    expect(save).not.toHaveBeenCalled();

    store.dispatch({ type: "leave-battle" });
    expect(save).toHaveBeenCalledTimes(1);
  });

  it("does NOT save mid-battle, but mastery is already banked on the player", () => {
    const save = vi.fn();
    const store = createGameStore(storeDeps(fakeSave({ save })));
    store.dispatch({ type: "new-game" });
    store.dispatch({ type: "start-battle", monsterId: "monster-eat" });
    save.mockClear();

    const battle = store.getSnapshot().battle!;
    store.dispatch({ type: "answer-question", optionIndex: battle.currentQuestion!.correctIndex });

    expect(save).not.toHaveBeenCalled();
    // T116: the answer is banked even though nothing was written yet, because mastery is applied
    // per answer. On reload the battle is gone; the learning is not.
    const attempts = Object.values(store.getSnapshot().player.mastery["eat"]!.components)
      .reduce((n, c) => n + c.attempts, 0);
    expect(attempts).toBe(1);
  });

  it("saves when equipment changes", () => {
    const save = vi.fn();
    const store = createGameStore(storeDeps(fakeSave({ save })));
    store.dispatch({ type: "new-game" });
    // Give the player something to equip by hand — this store has no direct inventory intent.
    const withItem: PlayerState = {
      ...store.getSnapshot().player,
      inventory: [{ itemId: "beginner-sword", quantity: 1 }],
    };
    const seeded = createGameStore(storeDeps(fakeSave({ save, load: () => ({ status: "ok", player: withItem }) })));
    seeded.dispatch({ type: "continue-game" });
    save.mockClear();
    seeded.dispatch({ type: "equip", itemId: "beginner-sword" });
    expect(save).toHaveBeenCalledTimes(1);
    expect(seeded.getSnapshot().player.equipped.weapon).toBe("beginner-sword");
  });
});

describe("storage unavailable (FR-056)", () => {
  it("warns the player immediately rather than failing to start", () => {
    const store = createGameStore(storeDeps(fakeSave({ isAvailable: () => false })));
    expect(store.getSnapshot().notice).toEqual({ kind: "storage-unavailable" });
  });

  it("still lets the game be played", () => {
    const store = createGameStore(storeDeps(fakeSave({ isAvailable: () => false })));
    expect(() => store.dispatch({ type: "new-game" })).not.toThrow();
    expect(store.getSnapshot().screen).toBe("world");
  });
});

describe("load on start (FR-055)", () => {
  it("starts a NEW game cleanly when no save exists", () => {
    const store = createGameStore(storeDeps(fakeSave({ load: () => ({ status: "empty" }) })));
    store.dispatch({ type: "continue-game" });
    expect(store.getSnapshot().screen).toBe("world");
    expect(store.getSnapshot().notice).toBeNull();
  });

  it("surfaces an unreadable save as a notice and stays on the title screen", () => {
    const store = createGameStore(storeDeps(fakeSave({ load: () => ({ status: "unreadable", reason: "malformed" }) })));
    expect(() => store.dispatch({ type: "continue-game" })).not.toThrow();
    expect(store.getSnapshot().notice).toEqual({ kind: "save-unreadable", detail: "malformed" });
    expect(store.getSnapshot().screen).toBe("title");
  });
});
