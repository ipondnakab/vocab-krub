import type { BalanceConfig, Item, RewardTable } from "../../content/schemas";
import { levelForXp, maxHpForLevel } from "../config/balance";
import type { ContentIndex } from "../content/loadContent";
import { wordsMasteredCount } from "../mastery/mastery";
import type { InventoryEntry, PlayerState } from "../player/playerState";
import type { Rng } from "../rng/rng";

/**
 * Rewards, levels, and unlocks (FR-039, FR-040, FR-044, FR-014).
 *
 * Constitution Principle IV: equipment is a reward for LEARNING, not for grinding. Every unlock
 * here is gated on words mastered or chapters completed — never on repetition alone.
 */

export interface RewardOutcome {
  player: PlayerState;
  leveledUp: boolean;
  levelsGained: number;
  xpGained: number;
  goldGained: number;
  itemsGained: string[];
  /** Equipment earned by crossing a mastery threshold (FR-044). */
  equipmentUnlocked: string[];
}

function addToInventory(inventory: InventoryEntry[], itemId: string): InventoryEntry[] {
  const existing = inventory.find((entry) => entry.itemId === itemId);
  if (!existing) return [...inventory, { itemId, quantity: 1 }];
  return inventory.map((entry) =>
    entry.itemId === itemId ? { ...entry, quantity: entry.quantity + 1 } : entry,
  );
}

export function owns(player: PlayerState, itemId: string): boolean {
  return player.inventory.some((entry) => entry.itemId === itemId);
}

/**
 * Items unlocked purely by what the player has learned.
 *
 * Checked after every payout so the moment a threshold is crossed the reward lands with it, and
 * the player can be told which milestone earned it.
 */
export function masteryUnlocks(player: PlayerState, content: ContentIndex): string[] {
  const mastered = wordsMasteredCount(player);
  return content.items
    .filter((item) => item.unlock?.type === "words-mastered" && mastered >= item.unlock.threshold)
    .filter((item) => !owns(player, item.id))
    .map((item) => item.id);
}

export function chapterUnlocks(player: PlayerState, chapterId: string, content: ContentIndex): string[] {
  return content.items
    .filter((item) => item.unlock?.type === "chapter-complete" && item.unlock.chapterId === chapterId)
    .filter((item) => !owns(player, item.id))
    .map((item) => item.id);
}

function xpMultiplier(player: PlayerState, content: ContentIndex): number {
  let multiplier = 1;
  for (const slot of ["weapon", "armor", "pet"] as const) {
    const id = player.equipped[slot];
    if (!id) continue;
    for (const effect of content.item(id).effects) {
      if (effect.kind === "xp-bonus") multiplier *= effect.value;
    }
  }
  return multiplier;
}

export function applyRewards(
  player: PlayerState,
  rewards: RewardTable,
  rng: Rng,
  balance: BalanceConfig,
  content: ContentIndex,
): RewardOutcome {
  const xpGained = Math.round(rewards.xp * xpMultiplier(player, content));
  const xp = player.xp + xpGained;
  const gold = player.gold + rewards.gold;

  const startLevel = player.level;
  const level = levelForXp(xp, balance);
  const leveledUp = level > startLevel;
  const maxHp = maxHpForLevel(level, balance);

  let inventory = player.inventory;
  const itemsGained: string[] = [];
  for (const drop of rewards.drops) {
    // Seeded, so a drop table is reproducible in tests and from a bug report.
    if (rng.next() < drop.chance) {
      inventory = addToInventory(inventory, drop.itemId);
      itemsGained.push(drop.itemId);
    }
  }

  // FR-040: levelling restores HP to the NEW maximum. Anything less makes levelling up feel
  // like a tax rather than a reward.
  const next: PlayerState = {
    ...player,
    xp,
    gold,
    level,
    maxHp,
    hp: leveledUp ? maxHp : Math.min(player.hp, maxHp),
    inventory,
  };

  const equipmentUnlocked = masteryUnlocks(next, content);
  const withUnlocks: PlayerState = {
    ...next,
    inventory: equipmentUnlocked.reduce(addToInventory, next.inventory),
  };

  return {
    player: withUnlocks,
    leveledUp,
    levelsGained: level - startLevel,
    xpGained,
    goldGained: rewards.gold,
    itemsGained,
    equipmentUnlocked,
  };
}

/**
 * FR-014. Defeat costs time and gold. It does NOT cost mastery, XP, level, or inventory.
 *
 * The signature is the guarantee: this returns a player built from an explicit field list, so
 * there is no code path here that could reduce learning progress even by accident.
 */
export function applyDefeatPenalty(
  player: PlayerState,
  balance: BalanceConfig,
  respawn: { mapId: string; x: number; y: number },
): { player: PlayerState; goldLost: number } {
  const goldLost = Math.floor(player.gold * balance.battle.defeatGoldPenalty);
  return {
    player: {
      ...player,
      gold: player.gold - goldLost,
      hp: player.maxHp,
      location: { mapId: respawn.mapId, x: respawn.x, y: respawn.y, facing: "down" },
    },
    goldLost,
  };
}

/** FR-041. Equipping validates the slot so a pet can never be worn as armor. */
export function equip(player: PlayerState, itemId: string, content: ContentIndex): PlayerState {
  const item = content.item(itemId);
  if (!owns(player, itemId)) throw new Error(`Cannot equip '${itemId}': not in inventory`);

  const slot = item.kind === "weapon" ? "weapon" : item.kind === "armor" ? "armor" : item.kind === "pet" ? "pet" : null;
  if (!slot) throw new Error(`Item '${itemId}' of kind '${item.kind}' is not equippable`);

  return { ...player, equipped: { ...player.equipped, [slot]: itemId } };
}

export function unequip(player: PlayerState, slot: "weapon" | "armor" | "pet"): PlayerState {
  return { ...player, equipped: { ...player.equipped, [slot]: null } };
}

export function equippedItems(player: PlayerState, content: ContentIndex): Item[] {
  return (["weapon", "armor", "pet"] as const)
    .map((slot) => player.equipped[slot])
    .filter((id): id is string => id !== null)
    .map((id) => content.item(id));
}
