import { deriveComponents } from "../../src/core/content/deriveComponents.ts";
import type { Question, VocabularyWord } from "../../src/content/schemas/index.ts";
import { thirdPerson } from "./morphology.ts";

/**
 * Content generation for the authoring CLI (FR-008, contracts/authoring-cli.md).
 *
 * Pure functions, deliberately separate from the interactive shell so every refusal rule is
 * testable without a terminal.
 *
 * The tool writes exactly the JSON a person could write by hand. If it ever emits something a
 * hand-editor cannot read and modify, there are two sources of truth and Principle III is broken.
 */

export interface Refusal {
  rule: string;
  message: string;
}

export interface WordDraft {
  id: string;
  word: string;
  meaningTh: string;
  meaningEn: string;
  topic: string;
  difficulty: number;
  /** [formId, text] pairs in canonical order: base, past, pp, prp, plural. */
  forms: Array<{ id: string; text: string; role: VocabularyWord["forms"][number]["role"] }>;
  exampleSentence: string;
  exampleTranslationTh: string;
}

const L = (th: string, en: string) => ({ th, en });

const ROLE_LABEL: Record<string, { th: string; en: string }> = {
  base: L("รูปปัจจุบัน", "base form"),
  past: L("รูปอดีต", "past"),
  pp: L("รูปช่องที่ 3", "past participle"),
  prp: L("รูปกำลังทำ", "present participle"),
  plural: L("รูปพหูพจน์", "plural"),
};

const FORM_META: Record<string, { level: 1 | 2 | 3 | 4 | 5; tier: Question["difficulty"]; grammar: string | null }> = {
  base: { level: 4, tier: "easy", grammar: "present-simple" },
  past: { level: 3, tier: "medium", grammar: "past-simple" },
  pp: { level: 4, tier: "hard", grammar: "past-simple" },
  prp: { level: 4, tier: "medium", grammar: "present-simple" },
  plural: { level: 3, tier: "medium", grammar: "present-simple" },
};

/**
 * Drops a form whose text duplicates an earlier one.
 *
 * `walked` / `walked` is true of EVERY regular verb, and a separate past-participle component
 * spelled identically to the past would only produce a question with two identical options. The
 * grammar is still real; it just cannot be tested by multiple choice, so the component is not
 * generated. Base and past are never dropped — see `checkRefusals`.
 */
export function dedupeForms(forms: WordDraft["forms"]): WordDraft["forms"] {
  const seen = new Set<string>();
  return forms.filter((f) => {
    if (seen.has(f.text)) return false;
    seen.add(f.text);
    return true;
  });
}

export function buildWord(draft: WordDraft): VocabularyWord {
  const forms = dedupeForms(draft.forms);
  return {
    id: draft.id,
    word: draft.word,
    meaning: L(draft.meaningTh, draft.meaningEn),
    cefr: "A1",
    topic: draft.topic,
    difficulty: draft.difficulty,
    forms: forms.map((f) => ({
      id: f.id,
      text: f.text,
      role: f.role,
      roleLabel: ROLE_LABEL[f.id] ?? L(f.id, f.id),
    })),
    examples: [
      {
        sentence: draft.exampleSentence,
        translation: L(draft.exampleTranslationTh, draft.exampleSentence),
        formId: forms[0]?.id ?? "base",
      },
    ],
  } as VocabularyWord;
}

/** Three distractors that are neither the answer nor another form sharing its grammatical role. */
function distractorsFor(correct: string, word: VocabularyWord, pool: string[]): string[] {
  const banned = new Set([correct]);
  const out: string[] = [];
  for (const candidate of [...word.forms.map((f) => f.text), ...pool]) {
    if (banned.has(candidate)) continue;
    out.push(candidate);
    banned.add(candidate);
    if (out.length === 3) break;
  }
  return out;
}

export function buildQuestions(word: VocabularyWord, otherWordTexts: string[]): Question[] {
  const questions: Question[] = [];
  const q = (
    id: string, component: string, level: 1 | 2 | 3 | 4 | 5,
    tier: Question["difficulty"], grammar: string | null,
    promptTh: string, promptEn: string, options: string[],
    whyTh: string, whyEn: string,
  ): Question =>
    ({
      id, wordId: word.id, component, level, difficulty: tier, requiresGrammar: grammar,
      prompt: L(promptTh, promptEn), options, correctIndex: 0, explanation: L(whyTh, whyEn),
    }) as Question;

  // Meaning — Thai prompt, ENGLISH options. The options are the material under test and are
  // never translated (FR-052 of feature 001).
  questions.push(q(
    `q-${word.id}-meaning`, "meaning", 1, "easy", null,
    `คำใดแปลว่า "${word.meaning.th}"?`, `Which word means "${word.meaning.en}"?`,
    [word.word, ...distractorsFor(word.word, word, otherWordTexts)],
    `"${word.word}" แปลว่า ${word.meaning.th}`, `"${word.word}" means ${word.meaning.en}.`,
  ));

  // Recognition — deliberately UNGATED so every monster has at least two questions a brand-new
  // player can answer. Chapter 1 shipped monsters whose entire pool was grammar-gated, and a
  // first battle fought before any lesson ran out of askable questions and threw.
  questions.push(q(
    `q-${word.id}-recognition`, "context", 2, "easy", null,
    `ประโยคใดใช้ "${word.word}" ได้ถูกต้อง?`, `Which sentence uses "${word.word}" correctly?`,
    [
      `I ${word.word} every day.`,
      `I ${word.word} yesterday.`,
      `I am ${word.word} every day.`,
      `I ${thirdPerson(word.word)} every day.`,
    ],
    `ใช้ "${word.word}" กับประธาน I และเหตุการณ์ที่ทำเป็นประจำ`,
    `Use "${word.word}" with I for something you do regularly.`,
  ));

  const FRAME: Record<string, [string, string]> = {
    base: ["เติมคำในช่องว่าง: I ___ every day.", "Fill in the blank: I ___ every day."],
    past: [`รูปอดีตของ "${word.word}" คืออะไร?`, `What is the past tense of "${word.word}"?`],
    pp: ["เติมคำในช่องว่าง: I have ___ already.", "Fill in the blank: I have ___ already."],
    prp: ["เติมคำในช่องว่าง: I am ___ now.", "Fill in the blank: I am ___ now."],
    plural: ["เติมคำในช่องว่าง: I have many ___.", "Fill in the blank: I have many ___."],
  };

  for (const form of word.forms) {
    const meta = FORM_META[form.id];
    const frame = FRAME[form.id];
    if (!meta || !frame) continue;
    questions.push(q(
      `q-${word.id}-${form.id}`, `form:${form.id}`, meta.level, meta.tier, meta.grammar,
      frame[0], frame[1],
      [form.text, ...distractorsFor(form.text, word, otherWordTexts)],
      `รูปนี้ของ "${word.word}" คือ "${form.text}"`,
      `The ${form.role} form of "${word.word}" is "${form.text}".`,
    ));
  }

  // Context — the situational question, gated on Past Simple.
  const past = word.forms.find((f) => f.id === "past")?.text ?? word.word;
  questions.push(q(
    `q-${word.id}-context`, "context", 5, "expert", "past-simple",
    `มีคนถามว่า "What did you do yesterday?" ควรตอบอย่างไร?`,
    `Someone asks, "What did you do yesterday?" How should you answer?`,
    [`I ${past} yesterday.`, `I ${word.word} yesterday.`,
     `I have ${word.word} yesterday.`, `I am ${word.word} yesterday.`],
    `คำถามใช้ "did" จึงต้องตอบด้วยรูปอดีต "${past}"`,
    `The question uses "did", so answer in the past: "${past}".`,
  ));

  return questions;
}

/**
 * The refusal rules (contracts/authoring-cli.md).
 *
 * Every one of these is a defect Chapter 1 actually shipped or nearly shipped. A refusal must
 * explain WHY in one sentence — the tool is also where an author learns the rule.
 */
export function checkRefusals(word: VocabularyWord, questions: Question[]): Refusal[] {
  const refusals: Refusal[] = [];

  // The refusal is narrow on purpose. Regular verbs legitimately spell past and past-participle
  // identically (walked / walked), and refusing those would reject most of A1 — a mistake this
  // rule made in its first form. What genuinely cannot be tested is a word whose BASE and PAST
  // are the same: "what is the past tense of read?" has no answerable set of options.
  const base = word.forms.find((f) => f.role === "base");
  const past = word.forms.find((f) => f.role === "past");
  if (base && !past) {
    refusals.push({
      rule: "homograph-forms",
      message: `"${word.id}" has no distinct past form — its past is spelled the same as its base ("${base.text}"), so "what is the past tense?" has no answerable set of options.`,
    });
  }

  const ungated = questions.filter((q) => q.requiresGrammar === null);
  if (ungated.length < 2) {
    refusals.push({
      rule: "insufficient-ungated",
      message: `"${word.id}" has only ${ungated.length} question answerable before any grammar is learned; a monster needs at least 2, or a first battle runs out of askable questions after one turn.`,
    });
  }

  const components = deriveComponents(word);
  const asked = new Set(questions.map((q) => q.component));
  for (const component of components) {
    if (!asked.has(component)) {
      refusals.push({
        rule: "uncovered-component",
        message: `No question exercises "${component}", so "${word.id}" could never reach 100% mastery.`,
      });
    }
  }

  for (const question of questions) {
    const seen = new Set<string>();
    for (const option of question.options) {
      if (seen.has(option)) {
        refusals.push({
          rule: "duplicate-option",
          message: `"${question.id}" offers "${option}" twice; the player cannot distinguish two identical options.`,
        });
        break;
      }
      seen.add(option);
    }
    if (/[฀-๿]/.test(question.options.join(""))) {
      refusals.push({
        rule: "translated-answer",
        message: `"${question.id}" has Thai script in an answer option; options are the English under test and are never translated.`,
      });
    }
  }

  return refusals;
}
