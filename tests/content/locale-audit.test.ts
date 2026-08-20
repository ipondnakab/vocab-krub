import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { rawContentFiles } from "../../src/content/data";
import { loadContent } from "../../src/core/content/loadContent";
import th from "../../src/locales/th.json";
import en from "../../src/locales/en.json";

const content = loadContent(rawContentFiles, "shipping");
const THAI = /[฀-๿]/;

/**
 * T125. The full localisation audit (FR-051, FR-052, SC-009).
 *
 * Two failure modes, opposite in direction and both invisible without a test:
 *   - instruction that was never translated, and
 *   - target-language English that WAS translated, which makes the question unanswerable.
 */
describe("locale audit — instruction is complete (FR-051)", () => {
  it("localises every content field the player reads", () => {
    for (const word of content.words) {
      expect(word.meaning.th, word.id).toMatch(THAI);
      expect(word.meaning.en.trim().length).toBeGreaterThan(0);
      for (const form of word.forms) expect(form.roleLabel.th, `${word.id}.${form.id}`).toMatch(THAI);
      for (const example of word.examples) expect(example.translation.th.trim().length).toBeGreaterThan(0);
    }
    for (const question of content.questions) {
      expect(question.prompt.th, question.id).toMatch(THAI);
      expect(question.explanation.th, question.id).toMatch(THAI);
      expect(question.prompt.en.trim().length).toBeGreaterThan(0);
      expect(question.explanation.en.trim().length).toBeGreaterThan(0);
    }
    for (const npc of content.npcs) expect(npc.name.th, npc.id).toMatch(THAI);
    for (const node of content.dialogue) {
      for (const line of node.lines) expect(line.th, node.id).toMatch(THAI);
    }
    for (const topic of content.grammar) {
      expect(topic.name.th, topic.id).toMatch(THAI);
      for (const page of topic.explanation) expect(page.th, topic.id).toMatch(THAI);
    }
    for (const item of content.items) {
      expect(item.name.th, item.id).toMatch(THAI);
      expect(item.description.th, item.id).toMatch(THAI);
    }
    for (const chapter of content.chapters) {
      expect(chapter.title.th, chapter.id).toMatch(THAI);
      // T023 (FR-018, SC-007): every map name carries Thai script and non-empty English.
      for (const mapId of chapter.mapIds) {
        const name = chapter.mapNames[mapId];
        expect(name?.th, `${chapter.id}.mapNames.${mapId}`).toMatch(THAI);
        expect(name?.en.trim().length, `${chapter.id}.mapNames.${mapId}`).toBeGreaterThan(0);
      }
    }
  });
});

describe("locale audit — target English is NEVER translated (FR-052)", () => {
  it("keeps every answer option free of Thai script", () => {
    // A Thai gloss where an English answer belongs makes the question unanswerable.
    for (const question of content.questions) {
      for (const option of question.options) {
        expect(THAI.test(option), `${question.id} option "${option}" contains Thai`).toBe(false);
      }
    }
  });

  it("keeps words, forms, examples, and grammar patterns in English only", () => {
    for (const word of content.words) {
      expect(THAI.test(word.word), word.id).toBe(false);
      for (const form of word.forms) expect(THAI.test(form.text), `${word.id}.${form.id}`).toBe(false);
      for (const example of word.examples) expect(THAI.test(example.sentence), word.id).toBe(false);
    }
    for (const topic of content.grammar) {
      for (const pattern of topic.patterns) expect(THAI.test(pattern), topic.id).toBe(false);
    }
  });
});

describe("locale audit — no user-visible string is hardcoded", () => {
  const uiFiles = (dir: string): string[] => {
    const out: string[] = [];
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) out.push(...uiFiles(path));
      else if (path.endsWith(".tsx")) out.push(path);
    }
    return out;
  };

  it("routes UI copy through the locale layer rather than inlining Thai", () => {
    // Thai literal text inside a component means a string that can never be shown in English.
    for (const file of uiFiles("src/components")) {
      const source = readFileSync(file, "utf8");
      // Strip comments before scanning — explanatory prose may legitimately mention Thai.
      const code = source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
      expect(THAI.test(code), `${file} contains hardcoded Thai; use t()`).toBe(false);
    }
  });
});

describe("locale bundles (SC-009)", () => {
  it("are 100% complete in both languages", () => {
    const thKeys = Object.keys(th).sort();
    const enKeys = Object.keys(en).sort();
    expect(thKeys).toEqual(enKeys);
    expect(thKeys.length).toBeGreaterThan(40);
  });

  it("carry Thai script in every Thai entry", () => {
    // Language endonyms are the one exception: a switcher shows each language in its OWN script,
    // so "EN" stays "EN" in the Thai bundle. Named explicitly rather than pattern-matched, so a
    // genuinely untranslated entry can never hide behind the exemption.
    const ENDONYMS = new Set(["common.localeEndonymEn", "common.localeEndonymTh"]);
    for (const [key, value] of Object.entries(th as Record<string, string>)) {
      if (ENDONYMS.has(key)) continue;
      expect(THAI.test(value), `th.${key} has no Thai script`).toBe(true);
    }
  });
});
