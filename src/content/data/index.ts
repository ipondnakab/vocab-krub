import balance from "./balance.json";
import vocabulary from "./vocabulary.json";
import questions from "./questions.json";
import grammar from "./grammar.json";
import monsters from "./monsters.json";
import npcs from "./npcs.json";
import dialogue from "./dialogue.json";
import items from "./items.json";
import pets from "./pets.json";
import chapters from "./chapters.json";

import type { RawContentFiles } from "../../core/content/loadContent.js";

/**
 * The shipped content, bundled at build time (plan.md § Constraints: fully offline-capable).
 *
 * Typed as `unknown` at the boundary on purpose — these are JSON documents until `loadContent`
 * validates them. Letting TypeScript infer a shape from the JSON would create a second, silent
 * source of truth beside the Zod schemas, and the two would drift.
 */
export const rawContentFiles: RawContentFiles = {
  "balance.json": balance,
  "vocabulary.json": vocabulary,
  "questions.json": questions,
  "grammar.json": grammar,
  "monsters.json": monsters,
  "npcs.json": npcs,
  "dialogue.json": dialogue,
  "items.json": items,
  "pets.json": pets,
  "chapters.json": chapters,
};
