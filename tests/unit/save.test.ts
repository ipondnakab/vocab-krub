import { describe, expect, it } from "vitest";
import {
  SAVE_SCHEMA_VERSION, deserialize, saveDocumentSchema, serialize,
} from "../../src/core/save/serialize";
import { initMastery, recordAnswer } from "../../src/core/mastery/mastery";
import { balance, content, player } from "../helpers/fixtures";
import { chapterProgressOf } from "../../src/core/chapter/challenge";
import type { PlayerState } from "../../src/core/player/playerState";

/**
 * A player with EVERY field populated non-trivially (SC-010, FR-054).
 *
 * Several words at different mastery stages, a partial streak, a demoted component, multiple
 * inventory entries, all three equipment slots filled, and both chapter progress states. A
 * round-trip test against a default player proves almost nothing.
 */
function fullyPopulated(): PlayerState {
  const go = (() => {
    let m = initMastery(content.word("go"));
    for (const c of Object.keys(m.components)) {
      m = recordAnswer(m, c, true, balance);
      m = recordAnswer(m, c, true, balance);
    }
    // Demote one component so the save carries a mid-streak, previously-mastered value.
    m = recordAnswer(m, "meaning", false, balance);
    return { ...m, encountered: true };
  })();

  const eat = (() => {
    let m = initMastery(content.word("eat"));
    m = recordAnswer(m, "meaning", true, balance); // partial streak, not yet mastered
    return { ...m, encountered: true };
  })();

  const see = { ...initMastery(content.word("see")), encountered: false }; // untouched

  return {
    level: 4,
    xp: 812,
    hp: 37,
    maxHp: 160,
    gold: 245,
    inventory: [
      { itemId: "beginner-sword", quantity: 1 },
      { itemId: "beginner-armor", quantity: 2 },
      { itemId: "owl", quantity: 1 },
    ],
    equipped: { weapon: "beginner-sword", armor: "beginner-armor", pet: "owl" },
    mastery: { go, eat, see },
    grammarLearned: ["present-simple", "past-simple"],
    monstersDefeated: ["monster-eat", "monster-go"],
    chapterProgress: {
      "chapter-1": {
        chapterId: "chapter-1", bossDefeated: true, challengeAttempts: 3,
        challengeBestScore: 0.9, completed: true,
      },
    },
    location: { mapId: "cave", x: 11, y: 7, facing: "left" },
    locale: "en",
  };
}

describe("save round trip (SC-010, FR-054)", () => {
  it("preserves 100% of tracked player state", () => {
    const before = fullyPopulated();
    const result = deserialize(serialize(before));
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.player).toEqual(before);
  });

  it("preserves every nested mastery detail exactly", () => {
    const before = fullyPopulated();
    const result = deserialize(serialize(before));
    if (result.status !== "ok") throw new Error("expected ok");

    // The demoted component is the one most likely to be quietly lost.
    expect(result.player.mastery["go"]!.components["meaning"]).toEqual(
      before.mastery["go"]!.components["meaning"],
    );
    expect(result.player.mastery["go"]!.components["meaning"]!.mastered).toBe(false);
    expect(result.player.mastery["go"]!.components["meaning"]!.streak).toBe(balance.mastery.streakRequired - 1);
    expect(result.player.mastery["eat"]!.components["meaning"]!.streak).toBe(1);
    expect(result.player.mastery["see"]!.encountered).toBe(false);
  });

  it("survives repeated round trips without drift", () => {
    let current = fullyPopulated();
    for (let i = 0; i < 5; i += 1) {
      const result = deserialize(serialize(current));
      if (result.status !== "ok") throw new Error("expected ok");
      current = result.player as PlayerState;
    }
    expect(current).toEqual(fullyPopulated());
  });

  it("writes the schema version and an ISO timestamp", () => {
    const document = saveDocumentSchema.parse(JSON.parse(serialize(fullyPopulated())));
    expect(document.schemaVersion).toBe(SAVE_SCHEMA_VERSION);
    expect(() => new Date(document.savedAt).toISOString()).not.toThrow();
  });

  it("has NO optional fields with silent defaults", () => {
    // A defaulted field is how a round trip loses data without failing.
    const before = fullyPopulated();
    const doc = JSON.parse(serialize(before)) as { player: Record<string, unknown> };
    for (const key of Object.keys(before)) {
      expect(doc.player, `'${key}' missing from the serialized document`).toHaveProperty(key);
    }
  });
});

describe("load failure paths (FR-055)", () => {
  it("reports malformed JSON without throwing", () => {
    expect(deserialize("{not json")).toEqual({ status: "unreadable", reason: "malformed" });
  });

  it("reports a schema violation WITH the offending field path", () => {
    const doc = JSON.parse(serialize(fullyPopulated())) as { player: Record<string, unknown> };
    doc.player["gold"] = "lots";
    const result = deserialize(JSON.stringify(doc));
    expect(result.status).toBe("unreadable");
    if (result.status === "unreadable") expect(result.reason).toContain("gold");
  });

  it("refuses a save from a NEWER version rather than guessing", () => {
    const doc = JSON.parse(serialize(fullyPopulated())) as { schemaVersion: number };
    doc.schemaVersion = SAVE_SCHEMA_VERSION + 1;
    expect(deserialize(JSON.stringify(doc))).toEqual({ status: "unreadable", reason: "newer-version" });
  });

  it("rejects a non-positive schema version outright", () => {
    // v1 is the FIRST version, so there is no valid older save to migrate from yet. The
    // migration branch in `deserialize` is genuinely unreachable today; it exists so that the
    // first format change is routine rather than a rewrite (Principle VII). Asserting it fires
    // would mean contorting the code to satisfy a test, so this asserts what is actually true:
    // a version below the valid range is refused as invalid, not silently accepted.
    const doc = JSON.parse(serialize(fullyPopulated())) as { schemaVersion: number };
    doc.schemaVersion = 0;
    const result = deserialize(JSON.stringify(doc));
    expect(result.status).toBe("unreadable");
    if (result.status === "unreadable") expect(result.reason).toContain("schemaVersion");
  });

  it("rejects an unknown extra field instead of silently dropping it", () => {
    // strictObject: a stray field means the writer and reader disagree, and that is worth knowing.
    const doc = JSON.parse(serialize(fullyPopulated())) as Record<string, unknown>;
    doc["surprise"] = true;
    expect(deserialize(JSON.stringify(doc)).status).toBe("unreadable");
  });

  it("never throws on any of these", () => {
    for (const raw of ["", "null", "[]", "{}", '{"schemaVersion":1}', "{not json"]) {
      expect(() => deserialize(raw)).not.toThrow();
      expect(deserialize(raw).status).toBe("unreadable");
    }
  });

  it("loads a save written before Chapter 2 existed, with no migration (FR-011)", () => {
    // Verified against the shipped code rather than assumed: chapterProgressOf returns a zeroed
    // default for a missing key, so a pre-Chapter-2 save is simply a player who has not started
    // it. A migration that does nothing would be worse than none — it implies a change happened.
    const old = fullyPopulated();
    expect(Object.keys(old.chapterProgress)).not.toContain("chapter-2");

    const result = deserialize(serialize(old));
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;

    const progress = chapterProgressOf(result.player as PlayerState, "chapter-2");
    expect(progress).toEqual({
      chapterId: "chapter-2", bossDefeated: false,
      challengeAttempts: 0, challengeBestScore: 0, completed: false,
    });
    // And nothing about Chapter 1 was disturbed.
    expect(result.player.chapterProgress["chapter-1"]).toEqual(old.chapterProgress["chapter-1"]);
  });

  it("treats a defaulted player as valid — a brand new game must save", () => {
    const fresh = player();
    const result = deserialize(serialize(fresh));
    expect(result.status).toBe("ok");
    if (result.status === "ok") expect(result.player).toEqual(fresh);
  });
});
