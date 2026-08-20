import { describe, expect, it } from "vitest";
import { buildQuestions, buildWord, checkRefusals, type WordDraft } from "../../scripts/authoring/generate.ts";
import { pluralize, presentParticiple, regularPast, thirdPerson } from "../../scripts/authoring/morphology.ts";
import { deriveComponents } from "../../src/core/content/deriveComponents";

/**
 * The authoring CLI's refusal rules (FR-003, FR-004, FR-005).
 *
 * Every test here guards a defect Chapter 1 actually shipped or nearly shipped. They exist so the
 * next author cannot repeat them — and so that if someone loosens a rule, this fails loudly.
 */

const draft = (over: Partial<WordDraft> = {}): WordDraft => ({
  id: "sing", word: "sing",
  meaningTh: "ร้องเพลง", meaningEn: "to make music with your voice",
  topic: "daily-life", difficulty: 2,
  forms: [
    { id: "base", text: "sing", role: "base" },
    { id: "past", text: "sang", role: "past" },
    { id: "pp", text: "sung", role: "past-participle" },
    { id: "prp", text: "singing", role: "present-participle" },
  ],
  exampleSentence: "I sing every day.",
  exampleTranslationTh: "ฉันร้องเพลงทุกวัน",
  ...over,
});

const OTHERS = ["walk", "drink", "house", "book"];
const generate = (d: WordDraft = draft()) => {
  const word = buildWord(d);
  return { word, questions: buildQuestions(word, OTHERS) };
};

describe("morphology — real forms, never invented ones", () => {
  it("builds third-person singular correctly", () => {
    // Chapter 1 shipped "I gos every day." A non-word is a weak distractor; "I goes" is the
    // mistake a learner actually makes, and that is the one worth offering.
    expect(thirdPerson("go")).toBe("goes");
    expect(thirdPerson("study")).toBe("studies");
    expect(thirdPerson("watch")).toBe("watches");
    expect(thirdPerson("play")).toBe("plays");
    expect(thirdPerson("walk")).toBe("walks");
  });

  it("never produces the naive append-s form for verbs that need -es or -ies", () => {
    for (const verb of ["go", "study", "watch", "fix", "buzz", "wash", "carry"]) {
      expect(thirdPerson(verb)).not.toBe(`${verb}s`);
    }
  });

  it("builds plurals, regular pasts, and present participles", () => {
    expect(pluralize("city")).toBe("cities");
    expect(pluralize("box")).toBe("boxes");
    expect(pluralize("book")).toBe("books");
    expect(regularPast("dance")).toBe("danced");
    expect(regularPast("study")).toBe("studied");
    expect(regularPast("walk")).toBe("walked");
    expect(presentParticiple("dance")).toBe("dancing");
    expect(presentParticiple("run")).toBe("running");
    expect(presentParticiple("go")).toBe("going");
  });
});

describe("REFUSAL: forms spelled identically (FR-003)", () => {
  it("refuses `read` / `read` / `read`", () => {
    // Chapter 1 hit this and the word had to be dropped after the fact.
    const { word, questions } = generate(draft({
      id: "read", word: "read",
      forms: [
        { id: "base", text: "read", role: "base" },
        { id: "past", text: "read", role: "past" },
        { id: "pp", text: "read", role: "past-participle" },
      ],
      exampleSentence: "I read every day.",
    }));
    const refusals = checkRefusals(word, questions);
    expect(refusals.some((r) => r.rule === "homograph-forms")).toBe(true);
  });

  it("explains WHY rather than just rejecting", () => {
    const { word, questions } = generate(draft({
      id: "cut", word: "cut",
      forms: [
        { id: "base", text: "cut", role: "base" },
        { id: "past", text: "cut", role: "past" },
      ],
      exampleSentence: "I cut it every day.",
    }));
    const refusal = checkRefusals(word, questions).find((r) => r.rule === "homograph-forms");
    expect(refusal?.message).toMatch(/no answerable set of options/);
  });

  it("ACCEPTS a regular verb whose past and participle are identical", () => {
    // walked / walked is true of every regular verb. The first version of this rule refused
    // them all, which would have rejected most of A1. Found by running the tool, not by testing.
    const { word, questions } = generate(draft({
      id: "jump", word: "jump",
      forms: [
        { id: "base", text: "jump", role: "base" },
        { id: "past", text: "jumped", role: "past" },
        { id: "pp", text: "jumped", role: "past-participle" },
        { id: "prp", text: "jumping", role: "present-participle" },
      ],
      exampleSentence: "I jump every day.",
    }));
    expect(checkRefusals(word, questions)).toEqual([]);
    // The duplicate participle is dropped rather than generating an unanswerable question.
    expect(word.forms.map((f) => f.text)).toEqual(["jump", "jumped", "jumping"]);
  });

  it("accepts a word whose forms are all distinct", () => {
    const { word, questions } = generate();
    expect(checkRefusals(word, questions).some((r) => r.rule === "homograph-forms")).toBe(false);
  });
});

describe("REFUSAL: too few ungated questions (FR-004)", () => {
  it("every generated word has at least 2 questions answerable with no grammar learned", () => {
    // Chapter 1 shipped monsters whose entire pool was grammar-gated; a first battle asked its
    // one askable question and then question selection threw.
    const { questions } = generate();
    const ungated = questions.filter((q) => q.requiresGrammar === null);
    expect(ungated.length).toBeGreaterThanOrEqual(2);
  });

  it("refuses a question set stripped down to one ungated question", () => {
    const { word, questions } = generate();
    const stripped = questions.filter((q) => q.id !== `q-${word.id}-recognition`);
    const refusal = checkRefusals(word, stripped).find((r) => r.rule === "insufficient-ungated");
    expect(refusal?.message).toMatch(/runs out of askable questions after one turn/);
  });
});

describe("REFUSAL: an uncovered mastery component (FR-005)", () => {
  it("generates a question for EVERY derived component", () => {
    const { word, questions } = generate();
    const asked = new Set(questions.map((q) => q.component));
    for (const component of deriveComponents(word)) expect(asked).toContain(component);
  });

  it("refuses when a component's question is removed", () => {
    const { word, questions } = generate();
    const stripped = questions.filter((q) => q.component !== "form:past");
    const refusal = checkRefusals(word, stripped).find((r) => r.rule === "uncovered-component");
    expect(refusal?.message).toMatch(/could never reach 100% mastery/);
  });
});

describe("REFUSAL: unanswerable options", () => {
  it("refuses a duplicated option", () => {
    const { word, questions } = generate();
    const broken = questions.map((q, i) =>
      i === 0 ? { ...q, options: [q.options[0]!, q.options[0]!, q.options[2]!, q.options[3]!] } : q);
    expect(checkRefusals(word, broken).some((r) => r.rule === "duplicate-option")).toBe(true);
  });

  it("refuses Thai script in an answer option", () => {
    // Options are the English under test. A Thai gloss there makes the question unanswerable.
    const { word, questions } = generate();
    const broken = questions.map((q, i) =>
      i === 0 ? { ...q, options: ["ร้องเพลง", q.options[1]!, q.options[2]!, q.options[3]!] } : q);
    const refusal = checkRefusals(word, broken).find((r) => r.rule === "translated-answer");
    expect(refusal?.message).toMatch(/never translated/);
  });

  it("passes a clean generated word with no refusals at all", () => {
    const { word, questions } = generate();
    expect(checkRefusals(word, questions)).toEqual([]);
  });
});

describe("generated content shape", () => {
  it("gives every question exactly four distinct options", () => {
    const { questions } = generate();
    for (const q of questions) {
      expect(q.options).toHaveLength(4);
      expect(new Set(q.options).size).toBe(4);
    }
  });

  it("keeps the correct answer at the authored index, for presentation to shuffle", () => {
    const { questions } = generate();
    for (const q of questions) expect(q.correctIndex).toBe(0);
  });

  it("localises every prompt and explanation, and translates no option", () => {
    const { questions } = generate();
    for (const q of questions) {
      expect(q.prompt.th.length).toBeGreaterThan(0);
      expect(q.prompt.en.length).toBeGreaterThan(0);
      expect(q.explanation.th.length).toBeGreaterThan(0);
      for (const option of q.options) expect(/[฀-๿]/.test(option)).toBe(false);
    }
  });

  it("covers question levels 1 through 5 across a word's set", () => {
    const { questions } = generate();
    const levels = new Set(questions.map((q) => q.level));
    for (const expected of [1, 2, 3, 4, 5]) expect(levels).toContain(expected);
  });
});
