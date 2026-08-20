import { createInterface } from "node:readline/promises";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { buildQuestions, buildWord, checkRefusals, type WordDraft } from "./authoring/generate.ts";
import { presentParticiple, regularPast } from "./authoring/morphology.ts";
import { loadContent } from "../src/core/content/loadContent.ts";
import { ContentValidationError, formatIssue } from "../src/core/content/errors.ts";

/**
 * The authoring CLI (FR-008, contracts/authoring-cli.md).
 *
 * Writes exactly the JSON a person could write by hand, into the existing content files. It
 * introduces NO new format — if it ever emits something a hand-editor cannot read and modify,
 * there are two sources of truth and Principle III is broken.
 *
 *   npm run author          add one word, guided
 *   npm run author:check    validate all content without writing
 */

const DATA = join(process.cwd(), "src", "content", "data");
const readJson = (file: string): Record<string, unknown> =>
  JSON.parse(readFileSync(join(DATA, file), "utf8")) as Record<string, unknown>;

const CONTENT_FILES = [
  "balance.json", "vocabulary.json", "questions.json", "grammar.json", "monsters.json",
  "npcs.json", "dialogue.json", "items.json", "pets.json", "chapters.json",
] as const;

/**
 * Read the content off disk rather than importing the app's bundle module.
 *
 * The app module uses bundler-style JSON imports, which Node would need import attributes for.
 * A script reading files is the simpler path, and it also means `--check` validates what is
 * actually ON DISK right now — including edits made by hand a moment ago.
 */
const readAllContent = (): Record<string, unknown> =>
  Object.fromEntries(CONTENT_FILES.map((file) => [file, readJson(file)]));
const writeJson = (file: string, value: unknown): void =>
  writeFileSync(join(DATA, file), `${JSON.stringify(value, null, 2)}\n`);

/** FR-002: report every problem at once, naming the file and field, in words an author can act on. */
function runCheck(): number {
  try {
    loadContent(readAllContent() as never, "structural");
    console.log("✓ All content is valid.");
    return 0;
  } catch (error) {
    if (!(error instanceof ContentValidationError)) throw error;
    const problems = error.issues.filter((i) => !i.message.startsWith("WARNING"));
    const warnings = error.issues.filter((i) => i.message.startsWith("WARNING"));

    if (problems.length > 0) {
      console.error(`\n✗ ${problems.length} problem(s) to fix:\n`);
      for (const issue of problems) console.error(`  ${formatIssue(issue)}`);
    }
    if (warnings.length > 0) {
      console.warn(`\n⚠ ${warnings.length} warning(s):\n`);
      for (const issue of warnings) console.warn(`  ${formatIssue(issue)}`);
    }
    console.error("");
    return problems.length > 0 ? 1 : 0;
  }
}

/**
 * Adds one word from a draft. Shared by the interactive and non-interactive paths so both
 * enforce exactly the same refusal rules — a scripted import must never be able to write
 * content an interactive author would be refused.
 */
function addWord(draft: WordDraft, chapterId: string): number {
  const vocabulary = readJson("vocabulary.json") as { words: Array<{ id: string; word: string }> };
  const questionsFile = readJson("questions.json") as { questions: unknown[] };
  const chapters = readJson("chapters.json") as { chapters: Array<{ id: string; vocabularyIds: string[] }> };

  if (vocabulary.words.some((w) => w.id === draft.id)) {
    console.error(`\n✗ "${draft.id}" already exists in vocabulary.json.\n`);
    return 1;
  }

  const built = buildWord(draft);
  const generated = buildQuestions(built, vocabulary.words.map((w) => w.word));

  // Refuse BEFORE writing. Every rule here is a defect Chapter 1 shipped or nearly shipped.
  const refusals = checkRefusals(built, generated, draft.forms);
  if (refusals.length > 0) {
    console.error(`\n✗ Cannot add "${draft.word}":\n`);
    for (const refusal of refusals) console.error(`  ${refusal.message}`);
    console.error("\nNothing was written.\n");
    return 1;
  }

  vocabulary.words.push(built as never);
  questionsFile.questions.push(...(generated as never[]));
  const chapter = chapters.chapters.find((c) => c.id === chapterId);
  if (chapter && !chapter.vocabularyIds.includes(draft.id)) chapter.vocabularyIds.push(draft.id);

  writeJson("vocabulary.json", vocabulary);
  writeJson("questions.json", questionsFile);
  writeJson("chapters.json", chapters);

  console.log(`\n✓ Added "${draft.word}" with ${generated.length} questions to ${chapterId}.`);
  console.log("  vocabulary.json, questions.json, chapters.json\n");
  console.log("Run `npm run author:check` to validate, or `npm test` for the full suite.\n");
  return 0;
}

/**
 * Non-interactive mode: `npm run author -- --json '{ ... }'`.
 *
 * Exists because an authoring tool that cannot be scripted cannot be demonstrated, bulk-imported,
 * or exercised in CI. It shares `addWord`, so it is subject to identical refusals.
 */
function runFromJson(raw: string): number {
  let parsed: WordDraft & { chapterId?: string };
  try {
    parsed = JSON.parse(raw) as WordDraft & { chapterId?: string };
  } catch {
    console.error("✗ --json was not valid JSON.");
    return 1;
  }
  return addWord({ ...parsed, id: parsed.id ?? parsed.word.toLowerCase() }, parsed.chapterId ?? "chapter-2");
}

async function runAuthor(): Promise<number> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const ask = async (question: string, fallback = ""): Promise<string> => {
    const answer = (await rl.question(fallback ? `${question} [${fallback}] ` : `${question} `)).trim();
    return answer === "" ? fallback : answer;
  };

  try {
    console.log("\nAdd a vocabulary word. Press Ctrl+C to stop.\n");

    const word = await ask("English word:");
    if (!word) { console.error("A word is required."); return 1; }

    const meaningTh = await ask("Meaning in Thai:");
    const meaningEn = await ask("Meaning in English:");
    const topic = await ask("Topic:", "daily-life");
    const kind = await ask("Verb or noun? (v/n):", "v");
    const chapterId = await ask("Chapter id:", "chapter-2");

    // Offer regular forms as defaults so an author types only the irregular ones.
    const forms: WordDraft["forms"] = [{ id: "base", text: word, role: "base" }];
    if (kind.startsWith("v")) {
      const past = await ask("Past tense:", regularPast(word));
      const pp = await ask("Past participle:", past);
      const prp = await ask("Present participle:", presentParticiple(word));
      forms.push(
        { id: "past", text: past, role: "past" },
        { id: "pp", text: pp, role: "past-participle" },
        { id: "prp", text: prp, role: "present-participle" },
      );
    } else {
      const plural = await ask("Plural (blank if uncountable):", "");
      if (plural) forms.push({ id: "plural", text: plural, role: "plural" });
    }

    const exampleSentence = await ask("One example sentence:", `I ${word} every day.`);
    const exampleTranslationTh = await ask("That sentence in Thai:");

    const draft: WordDraft = {
      id: word.toLowerCase(), word, meaningTh, meaningEn, topic, difficulty: 2,
      forms, exampleSentence, exampleTranslationTh,
    };

    return addWord(draft, chapterId);
  } finally {
    rl.close();
  }
}

const invokedDirectly = process.argv[1]?.endsWith("author.ts") ?? false;
if (invokedDirectly) {
  const jsonIndex = process.argv.indexOf("--json");
  const code = process.argv.includes("--check")
    ? runCheck()
    : jsonIndex >= 0
      ? runFromJson(process.argv[jsonIndex + 1] ?? "")
      : await runAuthor();
  process.exit(code);
}
