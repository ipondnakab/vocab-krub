import { describe, expect, it } from "vitest";
import { correctOptionText, gradeAnswer, presentQuestion } from "../../src/core/questions/present";
import { damageFor, incomingDamage, weaponMultiplier } from "../../src/core/questions/damage";
import { balance, content, rng } from "../helpers/fixtures";
import type { Item } from "../../src/content/schemas/index";

const question = content.question("q-go-past"); // correct answer: "went"

describe("presentation — shuffling (FR-021)", () => {
  it("varies option order across seeds", () => {
    const orders = new Set(
      Array.from({ length: 20 }, (_, i) => presentQuestion(question, rng(i + 1)).options.join("|")),
    );
    expect(orders.size).toBeGreaterThan(1);
  });

  it("always keeps the correct answer present after shuffling", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      expect(presentQuestion(question, rng(seed)).options).toContain("went");
    }
  });

  it("always remaps correctIndex to point at the correct answer", () => {
    for (let seed = 1; seed <= 50; seed += 1) {
      const presented = presentQuestion(question, rng(seed));
      expect(presented.options[presented.correctIndex]).toBe("went");
      expect(correctOptionText(presented)).toBe("went");
    }
  });

  it("preserves the full option set, never dropping or duplicating one", () => {
    const presented = presentQuestion(question, rng(3));
    expect([...presented.options].sort()).toEqual([...question.options].sort());
  });

  it("does not leak the authored ordering to renderers", () => {
    // Every authored question has correctIndex 0. If the raw Question reached the UI, the answer
    // would be the first option every single time.
    const presented = presentQuestion(question, rng(9));
    expect(Object.keys(presented)).not.toContain("question");
    expect(question.correctIndex).toBe(0);
  });

  it("moves the correct answer off index 0 for at least some seeds", () => {
    const positions = new Set(
      Array.from({ length: 30 }, (_, i) => presentQuestion(question, rng(i + 1)).correctIndex),
    );
    expect(positions.size).toBeGreaterThan(1);
  });
});

describe("grading", () => {
  it("is right for every option position", () => {
    for (let seed = 1; seed <= 30; seed += 1) {
      const presented = presentQuestion(question, rng(seed));
      for (let i = 0; i < presented.options.length; i += 1) {
        expect(gradeAnswer(presented, i)).toBe(i === presented.correctIndex);
      }
    }
  });

  it("rejects an out-of-range index rather than accidentally passing", () => {
    const presented = presentQuestion(question, rng(1));
    expect(gradeAnswer(presented, -1)).toBe(false);
    expect(gradeAnswer(presented, 99)).toBe(false);
  });
});

describe("damage from difficulty (FR-005, R-006)", () => {
  const tiers = [
    ["easy", 10], ["medium", 20], ["hard", 30], ["expert", 50],
  ] as const;

  it("yields the configured value for each tier", () => {
    for (const [tier, expected] of tiers) {
      expect(damageFor({ difficulty: tier }, null, balance)).toBe(expected);
    }
  });

  it("comes from the TIER, not the question's level", () => {
    // q-go-meaning is level 1 / easy; q-go-context is level 5 / expert. Two level-3 questions
    // with different tiers must differ, proving level is not the input.
    const past = presentQuestion(content.question("q-go-past"), rng(1)); // level 3, medium
    const pp = presentQuestion(content.question("q-go-pp"), rng(1)); // level 3, hard
    expect(past.level).toBe(pp.level);
    expect(damageFor(past, null, balance)).not.toBe(damageFor(pp, null, balance));
  });

  it("scales with an equipped weapon", () => {
    const sword = content.item("beginner-sword");
    expect(weaponMultiplier(sword)).toBe(1.2);
    expect(damageFor({ difficulty: "medium" }, sword, balance)).toBe(24);
    expect(damageFor({ difficulty: "medium" }, null, balance)).toBe(20);
  });

  it("responds to a balance edit with no code change (Principle III)", () => {
    const tuned = { ...balance, damage: { byDifficulty: { ...balance.damage.byDifficulty, medium: 99 } } };
    expect(damageFor({ difficulty: "medium" }, null, tuned)).toBe(99);
  });

  it("does not scale with player level — knowledge is the weapon, not grinding", () => {
    // damageFor takes no player. This test documents the omission as intentional.
    expect(damageFor.length).toBe(3);
  });
});

describe("incoming damage and armor (FR-006)", () => {
  const armor = content.item("beginner-armor"); // damage-reduction 4

  it("reduces damage by the armor's value", () => {
    expect(incomingDamage(18, armor)).toBe(14);
    expect(incomingDamage(18, null)).toBe(18);
  });

  it("FLOORS at zero, so armor can never heal", () => {
    const heavy = { ...armor, effects: [{ kind: "damage-reduction" as const, value: 999 }] } as Item;
    expect(incomingDamage(10, heavy)).toBe(0);
  });
});
