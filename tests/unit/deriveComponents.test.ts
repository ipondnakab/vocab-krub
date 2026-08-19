import { describe, expect, it } from "vitest";
import { deriveComponents, formComponentId } from "../../src/core/content/deriveComponents.js";
import type { VocabularyWord } from "../../src/content/schemas/index.js";

const localized = (s: string) => ({ th: s, en: s });

function word(formIds: string[]): VocabularyWord {
  return {
    id: "test-word",
    word: "test",
    meaning: localized("test"),
    cefr: "A1",
    topic: "test",
    difficulty: 1,
    forms: formIds.map((id) => ({
      id,
      text: id,
      role: "base" as const,
      roleLabel: localized(id),
    })),
    examples: [{ sentence: "A test.", translation: localized("A test."), formId: formIds[0]! }],
  };
}

describe("deriveComponents (FR-023)", () => {
  it("derives meaning + one per form + context for a multi-form word", () => {
    const components = deriveComponents(word(["base", "past", "past-participle", "present-participle"]));
    expect(components).toEqual([
      "meaning",
      "form:base",
      "form:past",
      "form:past-participle",
      "form:present-participle",
      "context",
    ]);
  });

  it("still produces a valid masterable set for a single-form word", () => {
    // Spec edge case: a word with no irregular forms must still be masterable.
    expect(deriveComponents(word(["base"]))).toEqual(["meaning", "form:base", "context"]);
  });

  it("derives a component for every declared form, with no duplicates", () => {
    const forms = ["base", "past", "gone", "going"];
    const components = deriveComponents(word(forms));
    expect(new Set(components).size).toBe(components.length);
    for (const id of forms) expect(components).toContain(formComponentId(id));
  });
});
