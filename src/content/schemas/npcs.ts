import { z } from "zod";
import { identifier, localized } from "./common.js";

export const npcSchema = z.strictObject({
  id: identifier(),
  name: localized(),
  role: z.enum(["teacher", "villager", "merchant", "scholar", "guard"]),
  mapId: identifier(),
  dialogueId: identifier(),
  /** Different dialogue once their lesson is done (FR-037). */
  repeatDialogueId: identifier(),
  grammarTopicId: identifier().nullable(),
  portrait: identifier(),
});

export const npcsSchema = z.strictObject({ npcs: z.array(npcSchema) });

export const dialogueNodeSchema = z.strictObject({
  id: identifier(),
  /** An NPC id, or the literal `player`. */
  speakerId: z.string().min(1),
  lines: z.array(localized()).min(1, "a dialogue node must have at least one line"),
  next: identifier().nullable(),
  /** Practice asked INSIDE the dialogue frame, in the NPC's voice (FR-035). */
  practiceQuestionIds: z.array(identifier()),
  /** Marks a grammar topic learned when this node completes (FR-036). */
  teachesGrammarId: identifier().nullable(),
});

export const dialogueSchema = z.strictObject({ nodes: z.array(dialogueNodeSchema) });

export type Npc = z.infer<typeof npcSchema>;
export type DialogueNode = z.infer<typeof dialogueNodeSchema>;
