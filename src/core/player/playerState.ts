import type { BalanceConfig, Direction } from "../../content/schemas/index";
import { maxHpForLevel } from "../config/balance";
import type { Locale } from "../i18n/i18n";

export interface ComponentMastery {
  streak: number;
  mastered: boolean;
  attempts: number;
  correct: number;
}

export interface WordMastery {
  wordId: string;
  components: Record<string, ComponentMastery>;
  /** Gates entry into the review pool (FR-020). */
  encountered: boolean;
}

export interface ChapterProgress {
  chapterId: string;
  bossDefeated: boolean;
  challengeAttempts: number;
  challengeBestScore: number;
  completed: boolean;
}

export interface InventoryEntry {
  itemId: string;
  quantity: number;
}

export interface Equipped {
  weapon: string | null;
  armor: string | null;
  pet: string | null;
}

export interface PlayerLocation {
  mapId: string;
  x: number;
  y: number;
  facing: Direction;
}

export interface PlayerState {
  level: number;
  xp: number;
  hp: number;
  /** Stored rather than derived, so a later balance change cannot retroactively alter a save. */
  maxHp: number;
  gold: number;
  inventory: InventoryEntry[];
  equipped: Equipped;
  mastery: Record<string, WordMastery>;
  grammarLearned: string[];
  monstersDefeated: string[];
  chapterProgress: Record<string, ChapterProgress>;
  location: PlayerLocation;
  locale: Locale;
}

export interface NewPlayerOptions {
  startMapId: string;
  startX: number;
  startY: number;
  facing?: Direction;
  locale?: Locale;
}

export function createNewPlayer(balance: BalanceConfig, options: NewPlayerOptions): PlayerState {
  const maxHp = maxHpForLevel(1, balance);
  return {
    level: 1,
    xp: 0,
    hp: maxHp,
    maxHp,
    gold: 0,
    inventory: [],
    equipped: { weapon: null, armor: null, pet: null },
    mastery: {},
    grammarLearned: [],
    monstersDefeated: [],
    chapterProgress: {},
    location: {
      mapId: options.startMapId,
      x: options.startX,
      y: options.startY,
      facing: options.facing ?? "down",
    },
    locale: options.locale ?? "th",
  };
}

/** FR-009: HP is always within [0, maxHp]. Nothing may write HP without going through here. */
export function clampHp(hp: number, maxHp: number): number {
  if (Number.isNaN(hp)) throw new Error("clampHp received NaN");
  if (hp < 0) return 0;
  if (hp > maxHp) return maxHp;
  return hp;
}

export function withHp(player: PlayerState, hp: number): PlayerState {
  return { ...player, hp: clampHp(hp, player.maxHp) };
}

/** Damage is floored at zero, so armor can never heal the player (FR-006). */
export function applyDamage(hp: number, damage: number, maxHp: number): number {
  return clampHp(hp - Math.max(0, damage), maxHp);
}
