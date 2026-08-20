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

  /*
   * A word is treated as a verb when the author supplied a past form. The distinction matters:
   * generating verb frames for a noun produced "I door every day." — nonsense that would have
   * shipped to a learner as a real answer option.
   */
  const pastForm = word.forms.find((f) => f.role === "past");
  const pluralForm = word.forms.find((f) => f.role === "plural");
  const isVerb = pastForm !== undefined;

  // Recognition — deliberately UNGATED so every monster has at least two questions a brand-new
  // player can answer. Chapter 1 shipped monsters whose entire pool was grammar-gated, and a
  // first battle fought before any lesson ran out of askable questions and threw.
  questions.push(
    isVerb
      ? q(
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
        )
      : pluralForm
        ? q(
            `q-${word.id}-recognition`, "context", 2, "easy", null,
            `ประโยคใดใช้ "${word.word}" ได้ถูกต้อง?`, `Which sentence uses "${word.word}" correctly?`,
            [
              `This is a ${word.word}.`,
              `This is a ${pluralForm.text}.`,
              `These is a ${word.word}.`,
              `This is an ${word.word}s.`,
            ],
            `"${word.word}" เป็นคำนามเอกพจน์ จึงใช้ "a" นำหน้า`,
            `"${word.word}" is a singular noun, so it takes "a".`,
          )
        : q(
            `q-${word.id}-recognition`, "context", 2, "easy", null,
            `ประโยคใดใช้ "${word.word}" ได้ถูกต้อง?`, `Which sentence uses "${word.word}" correctly?`,
            [
              `I need ${word.word}.`,
              `I need a ${word.word}.`,
              `I need ${word.word}s.`,
              `I needs ${word.word}.`,
            ],
            `"${word.word}" เป็นคำนามนับไม่ได้ จึงไม่ใช้ a และไม่เติม -s`,
            `"${word.word}" is uncountable, so it takes no "a" and no -s.`,
          ),
  );

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

  // Context — a situation, framed for the word's class.
  if (isVerb) {
    const past = pastForm.text;
    questions.push(q(
      `q-${word.id}-context`, "context", 5, "expert", "past-simple",
      `มีคนถามว่า "What did you do yesterday?" ควรตอบอย่างไร?`,
      `Someone asks, "What did you do yesterday?" How should you answer?`,
      [`I ${past} yesterday.`, `I ${word.word} yesterday.`,
       `I have ${word.word} yesterday.`, `I am ${word.word} yesterday.`],
      `คำถามใช้ "did" จึงต้องตอบด้วยรูปอดีต "${past}"`,
      `The question uses "did", so answer in the past: "${past}".`,
    ));
  } else if (pluralForm) {
    questions.push(q(
      `q-${word.id}-context`, "context", 5, "hard", "present-simple",
      `คุณเห็นสิ่งนี้สองอย่าง ควรพูดว่าอย่างไร?`,
      `You can see two of them. What should you say?`,
      [`I see two ${pluralForm.text}.`, `I see two ${word.word}.`,
       `I see a two ${pluralForm.text}.`, `I sees two ${pluralForm.text}.`],
      `จำนวนมากกว่าหนึ่งต้องใช้รูปพหูพจน์ "${pluralForm.text}"`,
      `More than one takes the plural "${pluralForm.text}".`,
    ));
  } else {
    questions.push(q(
      `q-${word.id}-context`, "context", 5, "hard", "present-simple",
      `คุณอยากบอกว่ามี "${word.meaning.th}" อยู่บ้าง ควรพูดว่าอย่างไร?`,
      `You want to say you have some. What should you say?`,
      [`I have some ${word.word}.`, `I have some ${word.word}s.`,
       `I have a ${word.word}.`, `I have an ${word.word}.`],
      `"${word.word}" นับไม่ได้ จึงใช้ "some" และไม่เติม -s`,
      `"${word.word}" is uncountable, so use "some" and no -s.`,
    ));
  }

  return questions;
}

/**
 * The refusal rules (contracts/authoring-cli.md).
 *
 * Every one of these is a defect Chapter 1 actually shipped or nearly shipped. A refusal must
 * explain WHY in one sentence — the tool is also where an author learns the rule.
 */
/**
 * @param suppliedForms the forms the AUTHOR wrote, before deduplication. Required to tell
 *   "this word has no past because it is a noun" from "this word's past collapsed into its
 *   base". Without it the rule cannot distinguish the two, and refuses every noun.
 */
export function checkRefusals(
  word: VocabularyWord,
  questions: Question[],
  suppliedForms?: WordDraft["forms"],
): Refusal[] {
  const refusals: Refusal[] = [];

  /*
   * This rule has been wrong twice, both times by being too broad, and both times caught by
   * running the tool rather than by a test:
   *
   *   v1 refused any word with two identically-spelled forms — which is EVERY regular verb
   *      (walked / walked). It would have rejected most of A1.
   *   v2 refused any word with no past form — which is EVERY NOUN. It rejected all twenty.
   *
   * The genuine defect is narrow: the author SUPPLIED a past form and it is spelled the same as
   * the base (read / read), so "what is the past tense?" has no answerable set of options. A
   * noun that never had a past is not a defect, and neither is walked / walked.
   */
  if (suppliedForms) {
    const suppliedBase = suppliedForms.find((f) => f.role === "base");
    const suppliedPast = suppliedForms.find((f) => f.role === "past");
    if (suppliedBase && suppliedPast && suppliedBase.text === suppliedPast.text) {
      refusals.push({
        rule: "homograph-forms",
        message: `"${word.id}" has a past form spelled the same as its base ("${suppliedBase.text}"), so "what is the past tense?" has no answerable set of options.`,
      });
    }
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
