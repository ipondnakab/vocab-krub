import { z } from "zod";
import { direction } from "../../content/schemas";

/**
 * The versioned save document (contracts/save-format.md).
 *
 * Every field is REQUIRED. There are no optional fields with silent defaults, because a
 * defaulted field is exactly how a round trip loses data without failing — the load succeeds,
 * the player's gold is quietly zero, and nothing reports it.
 */
export const SAVE_SCHEMA_VERSION = 1;
export const SAVE_STORAGE_KEY = "vocab-krub:save:v1";

const componentMasterySchema = z.strictObject({
  streak: z.number().int().nonnegative(),
  mastered: z.boolean(),
  attempts: z.number().int().nonnegative(),
  correct: z.number().int().nonnegative(),
});

const wordMasterySchema = z.strictObject({
  wordId: z.string().min(1),
  components: z.record(z.string(), componentMasterySchema),
  encountered: z.boolean(),
});

const chapterProgressSchema = z.strictObject({
  chapterId: z.string().min(1),
  bossDefeated: z.boolean(),
  challengeAttempts: z.number().int().nonnegative(),
  challengeBestScore: z.number().min(0).max(1),
  completed: z.boolean(),
});

export const playerStateSchema = z.strictObject({
  level: z.number().int().positive(),
  xp: z.number().int().nonnegative(),
  hp: z.number().int().nonnegative(),
  maxHp: z.number().int().positive(),
  gold: z.number().int().nonnegative(),
  inventory: z.array(z.strictObject({
    itemId: z.string().min(1),
    quantity: z.number().int().positive(),
  })),
  equipped: z.strictObject({
    weapon: z.string().nullable(),
    armor: z.string().nullable(),
    pet: z.string().nullable(),
  }),
  mastery: z.record(z.string(), wordMasterySchema),
  grammarLearned: z.array(z.string()),
  monstersDefeated: z.array(z.string()),
  chapterProgress: z.record(z.string(), chapterProgressSchema),
  location: z.strictObject({
    mapId: z.string().min(1),
    x: z.number().int().nonnegative(),
    y: z.number().int().nonnegative(),
    facing: direction(),
  }),
  locale: z.enum(["th", "en"]),
});

export const saveDocumentSchema = z.strictObject({
  schemaVersion: z.number().int().positive(),
  savedAt: z.string().min(1),
  gameVersion: z.string().min(1),
  player: playerStateSchema,
});

export type SaveDocument = z.infer<typeof saveDocumentSchema>;
export type SerializedPlayer = z.infer<typeof playerStateSchema>;

export function serialize(player: SerializedPlayer, gameVersion = "0.1.0", now = new Date()): string {
  const document: SaveDocument = {
    schemaVersion: SAVE_SCHEMA_VERSION,
    savedAt: now.toISOString(),
    gameVersion,
    player,
  };
  return JSON.stringify(document);
}

export type DeserializeResult =
  | { status: "ok"; player: SerializedPlayer }
  | { status: "unreadable"; reason: string };

/**
 * Reads a save document.
 *
 * Every failure is reported, none crash, and none half-load. `gameVersion` is informational
 * only and never branched on, so a patch release can never orphan a save.
 */
export function deserialize(raw: string): DeserializeResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { status: "unreadable", reason: "malformed" };
  }

  const envelope = saveDocumentSchema.safeParse(parsed);
  if (!envelope.success) {
    const issue = envelope.error.issues[0];
    const path = issue?.path.join(".") ?? "(root)";
    return { status: "unreadable", reason: `invalid: ${path}` };
  }

  if (envelope.data.schemaVersion > SAVE_SCHEMA_VERSION) {
    // A save from a NEWER build. Refusing beats guessing at fields we do not understand.
    return { status: "unreadable", reason: "newer-version" };
  }
  if (envelope.data.schemaVersion < SAVE_SCHEMA_VERSION) {
    // Migrations register here, applied in order. There is exactly one version today; the
    // mechanism exists so the first change is routine rather than a rewrite (Principle VII).
    return { status: "unreadable", reason: `no migration from v${envelope.data.schemaVersion}` };
  }

  return { status: "ok", player: envelope.data.player };
}
