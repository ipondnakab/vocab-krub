import { describe, expect, it } from "vitest";
import { applyDamage, clampHp, createNewPlayer, withHp } from "../../src/core/player/playerState.js";
import { levelForXp, maxHpForLevel } from "../../src/core/config/balance.js";
import type { BalanceConfig } from "../../src/content/schemas/index.js";

const balance: BalanceConfig = {
  damage: { byDifficulty: { easy: 10, medium: 20, hard: 30, expert: 50 } },
  player: { baseMaxHp: 100, hpPerLevel: 20, xpCurve: [0, 100, 250, 450] },
  mastery: { streakRequired: 2 },
  questions: {
    reviewProportion: 0.3, weightMonsterWord: 10, weightUnmasteredComponent: 3,
    weightMasteredComponent: 1, recencyPenalty: 0.2,
  },
  battle: { fleeSuccessChance: 0.6, defeatGoldPenalty: 0.1 },
  challenge: { defaultPassThreshold: 0.8 },
};

const start = { startMapId: "village", startX: 5, startY: 7 };

describe("createNewPlayer", () => {
  it("starts at level 1 with full HP and nothing owned", () => {
    const p = createNewPlayer(balance, start);
    expect(p.level).toBe(1);
    expect(p.xp).toBe(0);
    expect(p.gold).toBe(0);
    expect(p.hp).toBe(p.maxHp);
    expect(p.maxHp).toBe(balance.player.baseMaxHp);
    expect(p.inventory).toEqual([]);
    expect(p.equipped).toEqual({ weapon: null, armor: null, pet: null });
    expect(p.mastery).toEqual({});
    expect(p.grammarLearned).toEqual([]);
  });

  it("defaults to Thai, the primary audience's language", () => {
    expect(createNewPlayer(balance, start).locale).toBe("th");
    expect(createNewPlayer(balance, { ...start, locale: "en" }).locale).toBe("en");
  });
});

describe("HP clamping (FR-009)", () => {
  it("floors at exactly zero and never goes negative", () => {
    expect(clampHp(-1, 100)).toBe(0);
    expect(clampHp(-9999, 100)).toBe(0);
    expect(clampHp(0, 100)).toBe(0);
  });

  it("caps at maxHp and never exceeds it", () => {
    expect(clampHp(101, 100)).toBe(100);
    expect(clampHp(100, 100)).toBe(100);
  });

  it("throws on NaN rather than storing it", () => {
    // A NaN HP would silently break every comparison downstream, including victory checks.
    expect(() => clampHp(Number.NaN, 100)).toThrow();
  });

  it("routes through withHp so nothing writes HP unclamped", () => {
    const p = createNewPlayer(balance, start);
    expect(withHp(p, -50).hp).toBe(0);
    expect(withHp(p, 500).hp).toBe(p.maxHp);
  });
});

describe("applyDamage (FR-006)", () => {
  it("subtracts damage and floors at zero", () => {
    expect(applyDamage(100, 30, 100)).toBe(70);
    expect(applyDamage(10, 30, 100)).toBe(0);
  });

  it("treats negative damage as zero, so armor can never heal", () => {
    expect(applyDamage(50, -20, 100)).toBe(50);
  });

  it("lands on exactly zero when damage equals remaining HP", () => {
    expect(applyDamage(30, 30, 100)).toBe(0);
  });
});

describe("level and HP curves", () => {
  it("derives level from the authored XP curve", () => {
    expect(levelForXp(0, balance)).toBe(1);
    expect(levelForXp(99, balance)).toBe(1);
    expect(levelForXp(100, balance)).toBe(2); // exactly on the threshold
    expect(levelForXp(249, balance)).toBe(2);
    expect(levelForXp(250, balance)).toBe(3);
    expect(levelForXp(999999, balance)).toBe(4); // caps at the curve's end
  });

  it("grows max HP per level from balance", () => {
    expect(maxHpForLevel(1, balance)).toBe(100);
    expect(maxHpForLevel(2, balance)).toBe(120);
    expect(maxHpForLevel(3, balance)).toBe(140);
  });
});
