import { describe, expect, it } from "vitest";
import {
  encounteredWordIds,
  initMastery,
  isWordMastered,
  markEncountered,
  masteryPercent,
  recordAnswer,
  unmasteredComponentIds,
  wordsMasteredCount,
} from "../../src/core/mastery/mastery";
import type { BalanceConfig, VocabularyWord } from "../../src/content/schemas/index";
import type { PlayerState, WordMastery } from "../../src/core/player/playerState";

const L = (s: string) => ({ th: s, en: s });

const GO: VocabularyWord = {
  id: "go",
  word: "go",
  meaning: L("ไป"),
  cefr: "A1",
  topic: "movement",
  difficulty: 1,
  forms: [
    { id: "base", text: "go", role: "base", roleLabel: L("base") },
    { id: "past", text: "went", role: "past", roleLabel: L("past") },
    { id: "participle", text: "gone", role: "past-participle", roleLabel: L("pp") },
  ],
  examples: [{ sentence: "I go to school.", translation: L("ฉันไปโรงเรียน"), formId: "base" }],
};

const SINGLE: VocabularyWord = {
  ...GO,
  id: "cat",
  word: "cat",
  forms: [{ id: "base", text: "cat", role: "base", roleLabel: L("base") }],
};

/** streakRequired is read from balance, never hardcoded — asserted explicitly below. */
function balanceWith(streakRequired: number): BalanceConfig {
  return {
    damage: { byDifficulty: { easy: 10, medium: 20, hard: 30, expert: 50 } },
    player: { baseMaxHp: 100, hpPerLevel: 20, xpCurve: [0, 100] },
    mastery: { streakRequired },
    questions: {
      reviewProportion: 0.3,
      weightUnmasteredComponent: 3,
      weightMasteredComponent: 1,
      recencyPenalty: 0.2,
    },
    battle: { fleeSuccessChance: 0.6, defeatGoldPenalty: 0.1 },
    challenge: { defaultPassThreshold: 0.8 },
  };
}

const balance = balanceWith(2);
const answer = (m: WordMastery, component: string, correct: boolean, b = balance) =>
  recordAnswer(m, component, correct, b);

describe("mastery — promotion (FR-024)", () => {
  it("does NOT master on a single correct answer", () => {
    // Principle IV: one lucky guess out of four options is not evidence of knowledge.
    const m = answer(initMastery(GO), "meaning", true);
    expect(m.components["meaning"]?.streak).toBe(1);
    expect(m.components["meaning"]?.mastered).toBe(false);
  });

  it("masters on two consecutive correct answers", () => {
    let m = initMastery(GO);
    m = answer(m, "meaning", true);
    m = answer(m, "meaning", true);
    expect(m.components["meaning"]?.mastered).toBe(true);
  });

  it("requires the streak to be CONSECUTIVE", () => {
    let m = initMastery(GO);
    m = answer(m, "meaning", true);
    m = answer(m, "meaning", false);
    m = answer(m, "meaning", true);
    expect(m.components["meaning"]?.mastered).toBe(false);
    expect(m.components["meaning"]?.correct).toBe(2);
  });

  it("reads streakRequired from balance rather than hardcoding it", () => {
    let m = initMastery(GO);
    const strict = balanceWith(4);
    for (let i = 0; i < 3; i += 1) m = answer(m, "meaning", true, strict);
    expect(m.components["meaning"]?.mastered).toBe(false);
    m = answer(m, "meaning", true, strict);
    expect(m.components["meaning"]?.mastered).toBe(true);
  });
});

describe("mastery — demotion (FR-025)", () => {
  it("resets an UNMASTERED component's streak to zero on a miss", () => {
    let m = initMastery(GO);
    m = answer(m, "meaning", true);
    m = answer(m, "meaning", false);
    expect(m.components["meaning"]?.streak).toBe(0);
  });

  it("demotes a MASTERED component to one short of restoration, not to zero", () => {
    let m = initMastery(GO);
    m = answer(m, "meaning", true);
    m = answer(m, "meaning", true);
    expect(m.components["meaning"]?.mastered).toBe(true);

    m = answer(m, "meaning", false);
    expect(m.components["meaning"]?.mastered).toBe(false);
    expect(m.components["meaning"]?.streak).toBe(1); // streakRequired - 1, NOT 0
  });

  it("restores a demoted component with one correct review answer", () => {
    let m = initMastery(GO);
    m = answer(m, "meaning", true);
    m = answer(m, "meaning", true);
    m = answer(m, "meaning", false);
    m = answer(m, "meaning", true);
    expect(m.components["meaning"]?.mastered).toBe(true);
  });

  it("never resets a word's overall progress to zero because of one miss", () => {
    let m = initMastery(GO);
    for (const c of ["meaning", "form:base"]) {
      m = answer(m, c, true);
      m = answer(m, c, true);
    }
    const before = masteryPercent(m);
    m = answer(m, "meaning", false);
    expect(masteryPercent(m)).toBeGreaterThan(0);
    expect(masteryPercent(m)).toBeLessThan(before);
  });
});

describe("mastery — percentage (FR-026)", () => {
  it("is exactly 0 for an untouched word", () => {
    expect(masteryPercent(initMastery(GO))).toBe(0);
    expect(isWordMastered(initMastery(GO))).toBe(false);
  });

  it("is exact at a partial value", () => {
    // GO derives 5 components: meaning, form:base, form:past, form:participle, context.
    let m = initMastery(GO);
    expect(Object.keys(m.components)).toHaveLength(5);
    m = answer(m, "meaning", true);
    m = answer(m, "meaning", true);
    expect(masteryPercent(m)).toBeCloseTo(1 / 5, 10);
  });

  it("is exactly 1 when every component is mastered, and only then", () => {
    let m = initMastery(GO);
    const components = Object.keys(m.components);
    for (const c of components.slice(0, -1)) {
      m = answer(m, c, true);
      m = answer(m, c, true);
    }
    expect(isWordMastered(m)).toBe(false);

    const last = components.at(-1)!;
    m = answer(m, last, true);
    m = answer(m, last, true);
    expect(masteryPercent(m)).toBe(1);
    expect(isWordMastered(m)).toBe(true);
    expect(unmasteredComponentIds(m)).toEqual([]);
  });

  it("lets a single-form word reach 100%", () => {
    // Spec edge case: a word with no irregular forms must still be fully masterable.
    let m = initMastery(SINGLE);
    expect(Object.keys(m.components)).toEqual(["meaning", "form:base", "context"]);
    for (const c of Object.keys(m.components)) {
      m = answer(m, c, true);
      m = answer(m, c, true);
    }
    expect(isWordMastered(m)).toBe(true);
  });
});

describe("mastery — bookkeeping", () => {
  it("counts attempts and correct answers independently of streak", () => {
    let m = initMastery(GO);
    m = answer(m, "meaning", true);
    m = answer(m, "meaning", false);
    m = answer(m, "meaning", true);
    expect(m.components["meaning"]?.attempts).toBe(3);
    expect(m.components["meaning"]?.correct).toBe(2);
  });

  it("is pure — it never mutates the state it is given", () => {
    const original = initMastery(GO);
    const snapshot = JSON.stringify(original);
    answer(original, "meaning", true);
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it("throws on an unknown component rather than silently creating one", () => {
    // A typo in content must not quietly invent a component the player can never complete.
    expect(() => answer(initMastery(GO), "form:nonexistent", true)).toThrow(/no mastery component/);
  });

  it("tracks encountered words for the review pool (FR-020)", () => {
    const m = markEncountered(initMastery(GO));
    expect(m.encountered).toBe(true);
    expect(markEncountered(m)).toBe(m); // no needless new object
  });
});

describe("mastery — player-level aggregates (FR-044)", () => {
  function playerWith(...masteries: WordMastery[]): PlayerState {
    return {
      level: 1, xp: 0, hp: 100, maxHp: 100, gold: 0,
      inventory: [], equipped: { weapon: null, armor: null, pet: null },
      mastery: Object.fromEntries(masteries.map((m) => [m.wordId, m])),
      grammarLearned: [], monstersDefeated: [], chapterProgress: {},
      location: { mapId: "village", x: 0, y: 0, facing: "down" }, locale: "th",
    };
  }

  const fullyMastered = (word: VocabularyWord) => {
    let m = initMastery(word);
    for (const c of Object.keys(m.components)) {
      m = answer(m, c, true);
      m = answer(m, c, true);
    }
    return m;
  };

  it("counts only fully mastered words", () => {
    const partial = answer(initMastery(GO), "meaning", true);
    expect(wordsMasteredCount(playerWith(fullyMastered(SINGLE), partial))).toBe(1);
  });

  it("reports encountered words for review selection", () => {
    const seen = markEncountered(initMastery(GO));
    const unseen = initMastery(SINGLE);
    expect(encounteredWordIds(playerWith(seen, unseen))).toEqual(["go"]);
  });
});
