import { z } from "zod";
import {
  balanceConfigSchema,
  chaptersSchema,
  dialogueSchema,
  grammarSchema,
  itemsSchema,
  monstersSchema,
  npcsSchema,
  petsSchema,
  questionsSchema,
  vocabularySchema,
  type BalanceConfig,
  type Chapter,
  type DialogueNode,
  type GrammarTopic,
  type Item,
  type Monster,
  type Npc,
  type Question,
  type VocabularyWord,
} from "../../content/schemas/index";
import { deriveComponents } from "./deriveComponents";
import { ContentValidationError, formatPath, type ContentIssue } from "./errors";
import { validateContent, type ValidationLevel } from "./validate";

/** The raw, unparsed JSON documents, keyed by their filename. */
export interface RawContentFiles {
  "balance.json": unknown;
  "vocabulary.json": unknown;
  "questions.json": unknown;
  "grammar.json": unknown;
  "monsters.json": unknown;
  "npcs.json": unknown;
  "dialogue.json": unknown;
  "items.json": unknown;
  "pets.json": unknown;
  "chapters.json": unknown;
}

export interface ContentIndex {
  readonly balance: BalanceConfig;
  readonly words: readonly VocabularyWord[];
  readonly questions: readonly Question[];
  readonly grammar: readonly GrammarTopic[];
  readonly monsters: readonly Monster[];
  readonly npcs: readonly Npc[];
  readonly dialogue: readonly DialogueNode[];
  readonly items: readonly Item[];
  readonly chapters: readonly Chapter[];

  word(id: string): VocabularyWord;
  question(id: string): Question;
  grammarTopic(id: string): GrammarTopic;
  monster(id: string): Monster;
  npc(id: string): Npc;
  dialogueNode(id: string): DialogueNode;
  item(id: string): Item;
  chapter(id: string): Chapter;

  /** Derived mastery components for a word (FR-023), computed once at load. */
  componentsFor(wordId: string): readonly string[];
  questionsForWord(wordId: string): readonly Question[];
  questionsForComponent(wordId: string, componentId: string): readonly Question[];
}

/** Parses one file, converting Zod issues into our file+path+message triple (FR-050). */
function parseFile<T>(file: string, schema: z.ZodType<T>, raw: unknown, issues: ContentIssue[]): T | null {
  const result = schema.safeParse(raw);
  if (result.success) return result.data;
  for (const issue of result.error.issues) {
    issues.push({ file, path: formatPath(issue.path), message: issue.message });
  }
  return null;
}

/**
 * Loads and validates all content (FR-049, FR-050).
 *
 * Every error across every file is collected before throwing, so a content author fixing a batch
 * sees the whole list at once instead of rediscovering it one run at a time.
 */
export function loadContent(files: RawContentFiles, level: ValidationLevel = "structural"): ContentIndex {
  const issues: ContentIssue[] = [];

  const balance = parseFile("balance.json", balanceConfigSchema, files["balance.json"], issues);
  const vocabulary = parseFile("vocabulary.json", vocabularySchema, files["vocabulary.json"], issues);
  const questions = parseFile("questions.json", questionsSchema, files["questions.json"], issues);
  const grammar = parseFile("grammar.json", grammarSchema, files["grammar.json"], issues);
  const monsters = parseFile("monsters.json", monstersSchema, files["monsters.json"], issues);
  const npcs = parseFile("npcs.json", npcsSchema, files["npcs.json"], issues);
  const dialogue = parseFile("dialogue.json", dialogueSchema, files["dialogue.json"], issues);
  const items = parseFile("items.json", itemsSchema, files["items.json"], issues);
  const pets = parseFile("pets.json", petsSchema, files["pets.json"], issues);
  const chapters = parseFile("chapters.json", chaptersSchema, files["chapters.json"], issues);

  // Shape errors make cross-file checks meaningless, so report them alone rather than burying
  // them under a cascade of "unknown reference" noise caused by the missing data.
  if (
    !balance || !vocabulary || !questions || !grammar || !monsters ||
    !npcs || !dialogue || !items || !pets || !chapters
  ) {
    throw new ContentValidationError(issues);
  }

  issues.push(
    ...validateContent(
      {
        words: vocabulary.words,
        questions: questions.questions,
        grammar: grammar.topics,
        monsters: monsters.monsters,
        npcs: npcs.npcs,
        dialogue: dialogue.nodes,
        items: items.items,
        pets: pets.pets,
        chapters: chapters.chapters,
      },
      level,
    ),
  );

  if (issues.length > 0) throw new ContentValidationError(issues);

  const allItems = [...items.items, ...pets.pets];
  const wordById = new Map(vocabulary.words.map((w) => [w.id, w]));
  const questionById = new Map(questions.questions.map((q) => [q.id, q]));
  const grammarById = new Map(grammar.topics.map((g) => [g.id, g]));
  const monsterById = new Map(monsters.monsters.map((m) => [m.id, m]));
  const npcById = new Map(npcs.npcs.map((n) => [n.id, n]));
  const dialogueById = new Map(dialogue.nodes.map((d) => [d.id, d]));
  const itemById = new Map(allItems.map((i) => [i.id, i]));
  const chapterById = new Map(chapters.chapters.map((c) => [c.id, c]));

  const componentsByWord = new Map(vocabulary.words.map((w) => [w.id, deriveComponents(w)]));
  const questionsByWord = new Map<string, Question[]>();
  for (const question of questions.questions) {
    const list = questionsByWord.get(question.wordId);
    if (list) list.push(question);
    else questionsByWord.set(question.wordId, [question]);
  }

  const lookup =
    <T>(map: Map<string, T>, kind: string) =>
    (id: string): T => {
      const found = map.get(id);
      // Validation above already proved every authored reference resolves, so reaching here
      // means a caller invented an id. Throwing beats returning undefined and surfacing as a
      // blank screen three frames later.
      if (found === undefined) throw new Error(`Unknown ${kind} id: '${id}'`);
      return found;
    };

  return {
    balance,
    words: vocabulary.words,
    questions: questions.questions,
    grammar: grammar.topics,
    monsters: monsters.monsters,
    npcs: npcs.npcs,
    dialogue: dialogue.nodes,
    items: allItems,
    chapters: chapters.chapters,

    word: lookup(wordById, "word"),
    question: lookup(questionById, "question"),
    grammarTopic: lookup(grammarById, "grammar topic"),
    monster: lookup(monsterById, "monster"),
    npc: lookup(npcById, "npc"),
    dialogueNode: lookup(dialogueById, "dialogue node"),
    item: lookup(itemById, "item"),
    chapter: lookup(chapterById, "chapter"),

    componentsFor: (wordId) => componentsByWord.get(wordId) ?? [],
    questionsForWord: (wordId) => questionsByWord.get(wordId) ?? [],
    questionsForComponent: (wordId, componentId) =>
      (questionsByWord.get(wordId) ?? []).filter((q) => q.component === componentId),
  };
}
