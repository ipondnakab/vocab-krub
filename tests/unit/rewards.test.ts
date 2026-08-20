import { describe, expect, it } from "vitest";
import {
  applyDefeatPenalty, applyRewards, chapterUnlocks, equip, masteryUnlocks, owns, unequip,
} from "../../src/core/progression/rewards";
import { initMastery, recordAnswer, wordsMasteredCount } from "../../src/core/mastery/mastery";
import { balance, content, player, rng, scriptedRng } from "../helpers/fixtures";
import type { PlayerState, WordMastery } from "../../src/core/player/playerState";
import type { RewardTable } from "../../src/content/schemas";

const table = (over: Partial<RewardTable> = {}): RewardTable => ({ xp: 0, gold: 0, drops: [], ...over });

/** Fully masters a word, the honest way — two consecutive correct per component. */
function mastered(wordId: string): WordMastery {
  let m = initMastery(content.word(wordId));
  for (const component of Object.keys(m.components)) {
    m = recordAnswer(m, component, true, balance);
    m = recordAnswer(m, component, true, balance);
  }
  return { ...m, encountered: true };
}

describe("rewards (FR-039)", () => {
  it("pays out exactly what the monster's reward data says", () => {
    const monster = content.monster("monster-eat");
    const result = applyRewards(player(), monster.rewards, scriptedRng([0.99]), balance, content);
    expect(result.xpGained).toBe(monster.rewards.xp);
    expect(result.goldGained).toBe(monster.rewards.gold);
    expect(result.player.xp).toBe(monster.rewards.xp);
    expect(result.player.gold).toBe(monster.rewards.gold);
  });

  it("resolves a drop at chance 1 always, and at chance 0 never", () => {
    const always = applyRewards(player(), table({ drops: [{ itemId: "beginner-sword", chance: 1 }] }),
      rng(1), balance, content);
    expect(always.itemsGained).toEqual(["beginner-sword"]);
    expect(owns(always.player, "beginner-sword")).toBe(true);

    const never = applyRewards(player(), table({ drops: [{ itemId: "beginner-sword", chance: 0 }] }),
      rng(1), balance, content);
    expect(never.itemsGained).toEqual([]);
  });

  it("stacks a duplicate drop as quantity rather than a second entry", () => {
    const once = applyRewards(player(), table({ drops: [{ itemId: "beginner-sword", chance: 1 }] }),
      rng(1), balance, content).player;
    const twice = applyRewards(once, table({ drops: [{ itemId: "beginner-sword", chance: 1 }] }),
      rng(1), balance, content).player;
    expect(twice.inventory.filter((e) => e.itemId === "beginner-sword")).toHaveLength(1);
    expect(twice.inventory.find((e) => e.itemId === "beginner-sword")?.quantity).toBe(2);
  });
});

describe("levelling (FR-040)", () => {
  const curve = balance.player.xpCurve;

  it("levels up when XP crosses a threshold", () => {
    const result = applyRewards(player(), table({ xp: curve[1]! }), rng(1), balance, content);
    expect(result.leveledUp).toBe(true);
    expect(result.player.level).toBe(2);
  });

  it("does not level one XP short of the threshold", () => {
    const result = applyRewards(player(), table({ xp: curve[1]! - 1 }), rng(1), balance, content);
    expect(result.leveledUp).toBe(false);
    expect(result.player.level).toBe(1);
  });

  it("raises max HP and restores current HP to the NEW maximum", () => {
    // Levelling that leaves you hurt feels like a tax, not a reward.
    const wounded = player({ hp: 12 });
    const result = applyRewards(wounded, table({ xp: curve[1]! }), rng(1), balance, content);
    expect(result.player.maxHp).toBeGreaterThan(wounded.maxHp);
    expect(result.player.hp).toBe(result.player.maxHp);
  });

  it("handles multiple level-ups in one payout", () => {
    const result = applyRewards(player(), table({ xp: curve[3]! }), rng(1), balance, content);
    expect(result.levelsGained).toBe(3);
    expect(result.player.level).toBe(4);
  });

  it("does not heal when no level was gained", () => {
    const wounded = player({ hp: 12 });
    const result = applyRewards(wounded, table({ xp: 1 }), rng(1), balance, content);
    expect(result.player.hp).toBe(12);
  });
});

describe("equipment effects (FR-041)", () => {
  const withItems = (...ids: string[]): PlayerState =>
    player({ inventory: ids.map((itemId) => ({ itemId, quantity: 1 })) });

  it("equips into the matching slot", () => {
    const p = equip(withItems("beginner-sword"), "beginner-sword", content);
    expect(p.equipped.weapon).toBe("beginner-sword");
    expect(p.equipped.armor).toBeNull();
  });

  it("puts armor in the armor slot and a pet in the pet slot", () => {
    let p = equip(withItems("beginner-armor", "owl"), "beginner-armor", content);
    p = equip(p, "owl", content);
    expect(p.equipped.armor).toBe("beginner-armor");
    expect(p.equipped.pet).toBe("owl");
    // A pet can never be worn as armor.
    expect(p.equipped.armor).not.toBe("owl");
  });

  it("refuses to equip something the player does not own", () => {
    expect(() => equip(player(), "beginner-sword", content)).toThrow(/not in inventory/);
  });

  it("unequips a slot", () => {
    const p = equip(withItems("beginner-sword"), "beginner-sword", content);
    expect(unequip(p, "weapon").equipped.weapon).toBeNull();
  });

  it("applies an xp-bonus effect to XP earned", () => {
    // No shipped item carries xp-bonus yet; the effect kind is still wired end to end.
    const bonus = { ...content, item: (id: string) =>
      id === "test-charm"
        ? { id, name: { th: "", en: "" }, description: { th: "", en: "" }, kind: "pet" as const,
            effects: [{ kind: "xp-bonus" as const, value: 2 }], unlock: null }
        : content.item(id) };
    const p = player({ equipped: { weapon: null, armor: null, pet: "test-charm" } });
    expect(applyRewards(p, table({ xp: 50 }), rng(1), balance, bonus).xpGained).toBe(100);
  });
});

describe("equipment is earned by LEARNING (FR-044)", () => {
  it("grants the threshold item the moment enough words are mastered", () => {
    // Scholar's Robe unlocks at 3 mastered words.
    const p = player({ mastery: { go: mastered("go"), eat: mastered("eat"), see: mastered("see") } });
    expect(wordsMasteredCount(p)).toBe(3);
    expect(masteryUnlocks(p, content)).toContain("scholar-robe");
  });

  it("does NOT grant it one word short", () => {
    const p = player({ mastery: { go: mastered("go"), eat: mastered("eat") } });
    expect(wordsMasteredCount(p)).toBe(2);
    expect(masteryUnlocks(p, content)).not.toContain("scholar-robe");
  });

  it("reports the unlock through applyRewards so the player can be told why", () => {
    const p = player({ mastery: { go: mastered("go"), eat: mastered("eat"), see: mastered("see") } });
    const result = applyRewards(p, table({ xp: 1 }), rng(1), balance, content);
    expect(result.equipmentUnlocked).toContain("scholar-robe");
    expect(owns(result.player, "scholar-robe")).toBe(true);
  });

  it("never grants the same unlock twice", () => {
    const p = player({ mastery: { go: mastered("go"), eat: mastered("eat"), see: mastered("see") } });
    const first = applyRewards(p, table({ xp: 1 }), rng(1), balance, content).player;
    const second = applyRewards(first, table({ xp: 1 }), rng(1), balance, content);
    expect(second.equipmentUnlocked).toEqual([]);
    expect(first.inventory.find((e) => e.itemId === "scholar-robe")?.quantity).toBe(1);
  });

  it("grants the chapter reward on completion", () => {
    expect(chapterUnlocks(player(), "chapter-1", content)).toContain("owl");
  });
});

describe("defeat costs gold and time — never learning (FR-014)", () => {
  const respawn = { mapId: "village", x: 3, y: 7 };

  it("takes the configured fraction of gold", () => {
    const rich = player({ gold: 200 });
    const { player: after, goldLost } = applyDefeatPenalty(rich, balance, respawn);
    expect(goldLost).toBe(Math.floor(200 * balance.battle.defeatGoldPenalty));
    expect(after.gold).toBe(200 - goldLost);
  });

  it("returns the player to the village at full HP", () => {
    const { player: after } = applyDefeatPenalty(player({ hp: 0 }), balance, respawn);
    expect(after.hp).toBe(after.maxHp);
    expect(after.location).toMatchObject(respawn);
  });

  it("does NOT reduce mastery, XP, level, or inventory", () => {
    const invested = player({
      gold: 100, xp: 500, level: 3,
      inventory: [{ itemId: "beginner-sword", quantity: 1 }],
      mastery: { go: mastered("go") },
    });
    const { player: after } = applyDefeatPenalty(invested, balance, respawn);
    expect(after.mastery).toEqual(invested.mastery);
    expect(after.xp).toBe(invested.xp);
    expect(after.level).toBe(invested.level);
    expect(after.inventory).toEqual(invested.inventory);
    expect(wordsMasteredCount(after)).toBe(wordsMasteredCount(invested));
  });

  it("cannot drive gold negative when the player has none", () => {
    expect(applyDefeatPenalty(player({ gold: 0 }), balance, respawn).player.gold).toBe(0);
  });
});
