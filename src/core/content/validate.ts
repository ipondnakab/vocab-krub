import type {
  Chapter,
  Item,
  Monster,
  Npc,
  DialogueNode,
  GrammarTopic,
  Question,
  VocabularyWord,
} from "../../content/schemas/index";
import { deriveComponents } from "./deriveComponents";
import type { ContentIssue } from "./errors";

/**
 * Cross-file validation (contracts/content-schemas.md).
 *
 * Zod validates one file's shape. These rules span files, and all of them collect into one
 * report rather than failing on the first — fixing a batch of new content one error at a time
 * is exactly the slow loop that makes content authoring miserable.
 *
 * Two levels:
 *
 *   "structural" — always enforced. Referential integrity, uniqueness, answer soundness.
 *                  A violation here is a broken game.
 *   "shipping"   — adds content COMPLETENESS (SC-003, SC-004, per-component question coverage).
 *                  A violation here is an unfinished chapter, not a broken engine, so it is
 *                  gated: seed content in Phase 2 is deliberately incomplete, and T118 turns
 *                  this on once the full chapter is authored.
 */
export type ValidationLevel = "structural" | "shipping";

export interface RawContent {
  words: VocabularyWord[];
  questions: Question[];
  grammar: GrammarTopic[];
  monsters: Monster[];
  npcs: Npc[];
  dialogue: DialogueNode[];
  items: Item[];
  pets: Item[];
  chapters: Chapter[];
}

const CHAPTER_MINIMUMS = {
  vocabulary: 30,
  grammar: 2,
  npcs: 6,
  monsters: 6,
  items: 3,
  pets: 1,
} as const;

export function validateContent(content: RawContent, level: ValidationLevel = "structural"): ContentIssue[] {
  const issues: ContentIssue[] = [];
  const add = (file: string, path: string, message: string) => issues.push({ file, path, message });

  const wordById = new Map(content.words.map((w) => [w.id, w]));
  const questionById = new Map(content.questions.map((q) => [q.id, q]));
  const grammarById = new Map(content.grammar.map((g) => [g.id, g]));
  const monsterById = new Map(content.monsters.map((m) => [m.id, m]));
  const npcById = new Map(content.npcs.map((n) => [n.id, n]));
  const dialogueById = new Map(content.dialogue.map((d) => [d.id, d]));
  const allItems = [...content.items, ...content.pets];
  const itemById = new Map(allItems.map((i) => [i.id, i]));

  // ---------------------------------------------------------------- uniqueness
  const dupes = (file: string, field: string, ids: string[]) => {
    const seen = new Set<string>();
    ids.forEach((id, index) => {
      if (seen.has(id)) add(file, `${field}[${index}].id`, `duplicate id: '${id}'`);
      seen.add(id);
    });
  };
  dupes("vocabulary.json", "words", content.words.map((w) => w.id));
  dupes("questions.json", "questions", content.questions.map((q) => q.id));
  dupes("grammar.json", "topics", content.grammar.map((g) => g.id));
  dupes("monsters.json", "monsters", content.monsters.map((m) => m.id));
  dupes("npcs.json", "npcs", content.npcs.map((n) => n.id));
  dupes("dialogue.json", "nodes", content.dialogue.map((d) => d.id));
  dupes("items.json", "items", allItems.map((i) => i.id));
  dupes("chapters.json", "chapters", content.chapters.map((c) => c.id));

  // ---------------------------------------------------------------- vocabulary
  content.words.forEach((word, wi) => {
    const formIds = new Set<string>();
    word.forms.forEach((form, fi) => {
      if (formIds.has(form.id)) {
        add("vocabulary.json", `words[${wi}].forms[${fi}].id`, `duplicate form id: '${form.id}'`);
      }
      formIds.add(form.id);
    });
    word.examples.forEach((example, ei) => {
      if (!formIds.has(example.formId)) {
        add(
          "vocabulary.json",
          `words[${wi}].examples[${ei}].formId`,
          `references form '${example.formId}', which this word does not declare`,
        );
      }
    });
  });

  // ---------------------------------------------------------------- questions
  content.questions.forEach((question, qi) => {
    const at = (field: string) => `questions[${qi}].${field}`;
    const word = wordById.get(question.wordId);

    if (!word) {
      add("questions.json", at("wordId"), `references unknown word '${question.wordId}'`);
    } else {
      const components = deriveComponents(word);
      if (!components.includes(question.component)) {
        add(
          "questions.json",
          at("component"),
          `component '${question.component}' is not one of '${word.id}' components (${components.join(", ")})`,
        );
      }
    }

    if (question.requiresGrammar !== null && !grammarById.has(question.requiresGrammar)) {
      add("questions.json", at("requiresGrammar"), `references unknown grammar topic '${question.requiresGrammar}'`);
    }

    // FR-022: answer soundness.
    const seen = new Map<string, number>();
    question.options.forEach((option, oi) => {
      const previous = seen.get(option);
      if (previous !== undefined) {
        add("questions.json", at(`options[${oi}]`), `duplicate option: '${option}' (also at index ${previous})`);
      }
      seen.set(option, oi);
    });

    const correct = question.options[question.correctIndex];
    if (word && correct !== undefined && question.component.startsWith("form:")) {
      const targetFormId = question.component.slice("form:".length);
      const targetForm = word.forms.find((f) => f.id === targetFormId);

      if (targetForm && correct !== targetForm.text) {
        add(
          "questions.json",
          at(`options[${question.correctIndex}]`),
          `correct option is '${correct}' but this question targets form '${targetFormId}' whose text is '${targetForm.text}'`,
        );
      }

      // A distractor sharing the target's grammatical role is genuinely ambiguous: if a word
      // declares two past forms (learned / learnt), offering one as the answer and the other as
      // a distractor gives the player no way to be right. Distractors with a DIFFERENT role
      // (gone, going) are correct pedagogy and are left alone.
      if (targetForm) {
        question.options.forEach((option, oi) => {
          if (oi === question.correctIndex) return;
          const clash = word.forms.find((f) => f.text === option && f.role === targetForm.role);
          if (clash) {
            add(
              "questions.json",
              at(`options[${oi}]`),
              `distractor '${option}' is also a '${targetForm.role}' form of '${word.id}', so this question has two valid answers`,
            );
          }
        });
      }
    }
  });

  // ---------------------------------------------------------------- monsters
  content.monsters.forEach((monster, mi) => {
    const at = (field: string) => `monsters[${mi}].${field}`;
    if (!wordById.has(monster.wordId)) {
      add("monsters.json", at("wordId"), `references unknown word '${monster.wordId}'`);
    }
    monster.questionPoolIds.forEach((qid, qi) => {
      const question = questionById.get(qid);
      if (!question) {
        add("monsters.json", at(`questionPoolIds[${qi}]`), `references unknown question '${qid}'`);
      } else if (question.wordId !== monster.wordId) {
        add(
          "monsters.json",
          at(`questionPoolIds[${qi}]`),
          `question '${qid}' tests word '${question.wordId}' but this monster embodies '${monster.wordId}'`,
        );
      }
    });
    monster.rewards.drops.forEach((drop, di) => {
      if (!itemById.has(drop.itemId)) {
        add("monsters.json", at(`rewards.drops[${di}].itemId`), `references unknown item '${drop.itemId}'`);
      }
    });
  });

  // ---------------------------------------------------------------- npcs & dialogue
  content.npcs.forEach((npc, ni) => {
    const at = (field: string) => `npcs[${ni}].${field}`;
    if (!dialogueById.has(npc.dialogueId)) {
      add("npcs.json", at("dialogueId"), `references unknown dialogue node '${npc.dialogueId}'`);
    }
    if (!dialogueById.has(npc.repeatDialogueId)) {
      add("npcs.json", at("repeatDialogueId"), `references unknown dialogue node '${npc.repeatDialogueId}'`);
    }
    if (npc.grammarTopicId !== null && !grammarById.has(npc.grammarTopicId)) {
      add("npcs.json", at("grammarTopicId"), `references unknown grammar topic '${npc.grammarTopicId}'`);
    }
  });

  content.dialogue.forEach((node, di) => {
    const at = (field: string) => `nodes[${di}].${field}`;
    if (node.next !== null && !dialogueById.has(node.next)) {
      add("dialogue.json", at("next"), `references unknown dialogue node '${node.next}'`);
    }
    if (node.teachesGrammarId !== null && !grammarById.has(node.teachesGrammarId)) {
      add("dialogue.json", at("teachesGrammarId"), `references unknown grammar topic '${node.teachesGrammarId}'`);
    }
    node.practiceQuestionIds.forEach((qid, qi) => {
      if (!questionById.has(qid)) {
        add("dialogue.json", at(`practiceQuestionIds[${qi}]`), `references unknown question '${qid}'`);
      }
    });
    if (node.speakerId !== "player" && !npcById.has(node.speakerId)) {
      add("dialogue.json", at("speakerId"), `references unknown speaker '${node.speakerId}' (expected an npc id or 'player')`);
    }
  });

  // ---------------------------------------------------------------- items
  allItems.forEach((item, ii) => {
    if (item.unlock?.type === "chapter-complete") {
      const chapterId = item.unlock.chapterId;
      if (!content.chapters.some((c) => c.id === chapterId)) {
        add("items.json", `items[${ii}].unlock.chapterId`, `references unknown chapter '${chapterId}'`);
      }
    }
  });

  // ---------------------------------------------------------------- chapters
  content.chapters.forEach((chapter, ci) => {
    const at = (field: string) => `chapters[${ci}].${field}`;
    const missing = (field: string, ids: string[], has: (id: string) => boolean, kind: string) =>
      ids.forEach((id, i) => {
        if (!has(id)) add("chapters.json", at(`${field}[${i}]`), `references unknown ${kind} '${id}'`);
      });

    missing("vocabularyIds", chapter.vocabularyIds, (id) => wordById.has(id), "word");
    missing("grammarTopicIds", chapter.grammarTopicIds, (id) => grammarById.has(id), "grammar topic");
    missing("monsterIds", chapter.monsterIds, (id) => monsterById.has(id), "monster");
    missing("npcIds", chapter.npcIds, (id) => npcById.has(id), "npc");

    const boss = monsterById.get(chapter.bossMonsterId);
    if (!boss) {
      add("chapters.json", at("bossMonsterId"), `references unknown monster '${chapter.bossMonsterId}'`);
    } else if (!boss.isBoss) {
      add("chapters.json", at("bossMonsterId"), `monster '${boss.id}' is not flagged isBoss`);
    }

    const guard = npcById.get(chapter.challenge.guardNpcId);
    if (!guard) {
      add("chapters.json", at("challenge.guardNpcId"), `references unknown npc '${chapter.challenge.guardNpcId}'`);
    } else if (guard.role !== "guard") {
      add("chapters.json", at("challenge.guardNpcId"), `npc '${guard.id}' has role '${guard.role}', expected 'guard'`);
    }

    if (level !== "shipping") return;

    // -------------------------------------------------------------- shipping only
    const counts: Array<[keyof typeof CHAPTER_MINIMUMS, string, number]> = [
      ["vocabulary", "vocabularyIds", chapter.vocabularyIds.length],
      ["grammar", "grammarTopicIds", chapter.grammarTopicIds.length],
      ["npcs", "npcIds", chapter.npcIds.length],
      ["monsters", "monsterIds", chapter.monsterIds.length],
    ];
    for (const [key, field, actual] of counts) {
      const min = CHAPTER_MINIMUMS[key];
      if (actual < min) {
        add("chapters.json", at(field), `chapter declares ${actual} ${key}, shipping minimum is ${min} (SC-003)`);
      }
    }
    if (content.items.length < CHAPTER_MINIMUMS.items) {
      add("items.json", "items", `${content.items.length} items, shipping minimum is ${CHAPTER_MINIMUMS.items} (SC-003)`);
    }
    if (content.pets.length < CHAPTER_MINIMUMS.pets) {
      add("pets.json", "pets", `${content.pets.length} pets, shipping minimum is ${CHAPTER_MINIMUMS.pets} (SC-003)`);
    }

    // Every component of every chapter word needs at least one question, or that component can
    // never be mastered and the word can never reach 100%.
    for (const wordId of chapter.vocabularyIds) {
      const word = wordById.get(wordId);
      if (!word) continue;
      const asked = new Set(content.questions.filter((q) => q.wordId === wordId).map((q) => q.component));
      for (const component of deriveComponents(word)) {
        if (!asked.has(component)) {
          add(
            "questions.json",
            `questions(word='${wordId}')`,
            `no question exercises component '${component}', so '${wordId}' can never reach 100% mastery`,
          );
        }
      }
    }

    // SC-004: every question level 1-5 appears at least once in the chapter.
    const chapterWords = new Set(chapter.vocabularyIds);
    const levels = new Set(content.questions.filter((q) => chapterWords.has(q.wordId)).map((q) => q.level));
    for (const expected of [1, 2, 3, 4, 5]) {
      if (!levels.has(expected as 1 | 2 | 3 | 4 | 5)) {
        add("questions.json", at("vocabularyIds"), `no level-${expected} question appears in this chapter (SC-004)`);
      }
    }
  });

  return issues;
}
