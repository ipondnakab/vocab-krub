import type { VocabularyWord } from "../../content/schemas/index";

/**
 * A word's mastery components are DERIVED, never authored (FR-023).
 *
 * `meaning` + one component per declared form + `context`.
 *
 * Deriving rather than authoring guarantees the component set can never drift from the word's
 * actual forms — add a form to GO and its component appears automatically, and a question can
 * immediately target it. It also means a single-form word still produces a valid, masterable
 * set, which is the edge case in the spec.
 */
export const MEANING_COMPONENT = "meaning";
export const CONTEXT_COMPONENT = "context";

export function formComponentId(formId: string): string {
  return `form:${formId}`;
}

export function deriveComponents(word: VocabularyWord): string[] {
  return [
    MEANING_COMPONENT,
    ...word.forms.map((form) => formComponentId(form.id)),
    CONTEXT_COMPONENT,
  ];
}
