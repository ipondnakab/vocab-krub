import { describe, expect, it } from "vitest";
import { rawContentFiles } from "../../src/content/data/index";
import { loadContent } from "../../src/core/content/loadContent";
import { ContentValidationError } from "../../src/core/content/errors";
import { deriveComponents } from "../../src/core/content/deriveComponents";

/**
 * Every shipped content file, validated exactly as the game validates it at load (FR-050).
 *
 * This is the test that lets a designer add a word and find out in CI that they mistyped a
 * grammar topic id, instead of a player finding a blank battle screen.
 */
describe("shipped content", () => {
  it("loads and passes every structural validation rule", () => {
    expect(() => loadContent(rawContentFiles)).not.toThrow();
  });

  /**
   * T118. Chapter 1 is now authored to shipping size, so the SC-003/SC-004 completeness rules
   * are switched ON: 30+ words, every mastery component has a question, all five levels appear,
   * and the chapter meets its NPC/monster/item minimums.
   */
  it("passes SHIPPING completeness validation (SC-003, SC-004)", () => {
    expect(() => loadContent(rawContentFiles, "shipping")).not.toThrow();
  });

  const content = loadContent(rawContentFiles, "shipping");

  it("indexes every entity by id", () => {
    expect(content.word("go").word).toBe("go");
    expect(content.monster("monster-go").isBoss).toBe(true);
    expect(content.chapter("chapter-1").bossMonsterId).toBe("monster-go");
    expect(content.grammarTopic("present-simple").cefr).toBe("A1");
    expect(content.npc("guard-thanet").role).toBe("guard");
    expect(content.item("owl").kind).toBe("pet");
  });

  it("throws on an id nothing authored, rather than returning undefined", () => {
    expect(() => content.word("does-not-exist")).toThrow(/Unknown word id/);
  });

  it("derives mastery components for every word", () => {
    for (const word of content.words) {
      const components = content.componentsFor(word.id);
      expect(components).toEqual(deriveComponents(word));
      expect(components).toContain("meaning");
      expect(components).toContain("context");
      expect(components.length).toBe(word.forms.length + 2);
    }
  });

  it("gives the boss word a question for every one of its components", () => {
    // The chapter boss must be fully masterable, or the slice cannot demonstrate a word
    // reaching 100%.
    for (const component of content.componentsFor("go")) {
      expect(content.questionsForComponent("go", component).length).toBeGreaterThan(0);
    }
  });

  it("covers question levels 1 through 5 and every difficulty tier (SC-004)", () => {
    expect(new Set(content.questions.map((q) => q.level))).toEqual(new Set([1, 2, 3, 4, 5]));
    expect(new Set(content.questions.map((q) => q.difficulty))).toEqual(
      new Set(["easy", "medium", "hard", "expert"]),
    );
  });

  it("has no question above level 5 (FR-016 — level 6 is cut)", () => {
    for (const question of content.questions) expect(question.level).toBeLessThanOrEqual(5);
  });

  it("gives every monster a non-empty pool of questions about its own word", () => {
    for (const monster of content.monsters) {
      expect(monster.questionPoolIds.length).toBeGreaterThan(0);
      for (const id of monster.questionPoolIds) {
        expect(content.question(id).wordId).toBe(monster.wordId);
      }
    }
  });

  it("keeps target-language text out of the localization layer (FR-052)", () => {
    // A word, its forms, and every answer option are the material under test. If any of these
    // were a { th, en } object, a Thai player would be shown a Thai gloss where the English
    // answer should be — and the question would become unanswerable.
    for (const word of content.words) {
      expect(typeof word.word).toBe("string");
      for (const form of word.forms) expect(typeof form.text).toBe("string");
    }
    for (const question of content.questions) {
      for (const option of question.options) expect(typeof option).toBe("string");
    }
  });

  it("localizes every instructional field in both th and en (FR-051)", () => {
    for (const question of content.questions) {
      for (const field of [question.prompt, question.explanation]) {
        expect(field.th.trim().length).toBeGreaterThan(0);
        expect(field.en.trim().length).toBeGreaterThan(0);
      }
    }
    for (const word of content.words) {
      expect(word.meaning.th.trim().length).toBeGreaterThan(0);
      expect(word.meaning.en.trim().length).toBeGreaterThan(0);
    }
  });

  it("gives every wrong answer something to teach (FR-004)", () => {
    for (const question of content.questions) {
      expect(question.explanation.th.length).toBeGreaterThan(3);
      expect(question.explanation.en.length).toBeGreaterThan(3);
    }
  });
});

describe("content validation failures (FR-050)", () => {
  const brokenFiles = (patch: Record<string, unknown>) => ({ ...rawContentFiles, ...patch });

  it("names the file and field path for a schema error", () => {
    const bad = brokenFiles({
      "vocabulary.json": { words: [{ id: "x", word: "x" }] },
    });
    try {
      loadContent(bad);
      expect.unreachable("should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(ContentValidationError);
      const issues = (error as ContentValidationError).issues;
      expect(issues[0]?.file).toBe("vocabulary.json");
      expect(issues[0]?.path).toMatch(/^words\[0\]/);
    }
  });

  it("rejects a level-6 question outright (FR-016)", () => {
    const withLevelSix = structuredClone(rawContentFiles["questions.json"]) as {
      questions: Array<Record<string, unknown>>;
    };
    withLevelSix.questions[0]!["level"] = 6;
    expect(() => loadContent(brokenFiles({ "questions.json": withLevelSix }))).toThrow(
      ContentValidationError,
    );
  });

  it("rejects a Localized object where target-language text belongs (FR-052)", () => {
    const patched = structuredClone(rawContentFiles["vocabulary.json"]) as {
      words: Array<{ word: unknown }>;
    };
    patched.words[0]!.word = { th: "ไป", en: "go" };
    expect(() => loadContent(brokenFiles({ "vocabulary.json": patched }))).toThrow(
      ContentValidationError,
    );
  });

  it("catches a dangling reference across files", () => {
    const patched = structuredClone(rawContentFiles["monsters.json"]) as {
      monsters: Array<{ wordId: string }>;
    };
    patched.monsters[0]!.wordId = "no-such-word";
    try {
      loadContent(brokenFiles({ "monsters.json": patched }));
      expect.unreachable("should have thrown");
    } catch (error) {
      const issues = (error as ContentValidationError).issues;
      expect(issues.some((i) => i.message.includes("no-such-word"))).toBe(true);
    }
  });

  it("catches a duplicate answer option (FR-022)", () => {
    const patched = structuredClone(rawContentFiles["questions.json"]) as {
      questions: Array<{ options: string[] }>;
    };
    patched.questions[0]!.options[1] = patched.questions[0]!.options[0]!;
    try {
      loadContent(brokenFiles({ "questions.json": patched }));
      expect.unreachable("should have thrown");
    } catch (error) {
      const issues = (error as ContentValidationError).issues;
      expect(issues.some((i) => i.message.includes("duplicate option"))).toBe(true);
    }
  });

  it("catches a form question whose correct option is not that form's text", () => {
    // Authoring mistake: "past tense of go?" with the answer set to "gone".
    const patched = structuredClone(rawContentFiles["questions.json"]) as {
      questions: Array<{ id: string; options: string[]; correctIndex: number }>;
    };
    const past = patched.questions.find((q) => q.id === "q-go-past")!;
    past.correctIndex = past.options.indexOf("gone");
    try {
      loadContent(brokenFiles({ "questions.json": patched }));
      expect.unreachable("should have thrown");
    } catch (error) {
      const issues = (error as ContentValidationError).issues;
      expect(issues.some((i) => i.message.includes("targets form"))).toBe(true);
    }
  });

  it("collects EVERY error rather than stopping at the first", () => {
    // Fixing a batch of new content one error per run is the loop that makes authoring painful.
    const patched = structuredClone(rawContentFiles["monsters.json"]) as {
      monsters: Array<{ wordId: string; questionPoolIds: string[] }>;
    };
    patched.monsters[0]!.wordId = "nope-one";
    patched.monsters[1]!.wordId = "nope-two";
    try {
      loadContent(brokenFiles({ "monsters.json": patched }));
      expect.unreachable("should have thrown");
    } catch (error) {
      const issues = (error as ContentValidationError).issues;
      expect(issues.length).toBeGreaterThan(1);
      expect(issues.some((i) => i.message.includes("nope-one"))).toBe(true);
      expect(issues.some((i) => i.message.includes("nope-two"))).toBe(true);
    }
  });

  it("renders an issue as file → path: message", () => {
    try {
      loadContent(brokenFiles({ "vocabulary.json": { words: [{ id: "x" }] } }));
      expect.unreachable("should have thrown");
    } catch (error) {
      expect((error as ContentValidationError).message).toMatch(/vocabulary\.json → words\[0\]\..+:/);
    }
  });
});
